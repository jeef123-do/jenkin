import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

public class SmokeCheck {
    public static void main(String[] args) throws Exception {
        if (args.length < 1 || args.length > 2
                || (args.length == 2 && !"remote".equals(args[1]))) {
            throw new IllegalArgumentException("Expected a health endpoint and optional 'remote' mode.");
        }
        URI endpoint = URI.create(args[0]);
        boolean remote = args.length == 2;
        if (remote) {
            String host = endpoint.getHost();
            if (!"https".equalsIgnoreCase(endpoint.getScheme()) || host == null
                    || endpoint.getRawUserInfo() != null || endpoint.getRawQuery() != null
                    || endpoint.getRawFragment() != null) {
                throw new IllegalArgumentException(
                        "Remote health endpoint must be HTTPS without credentials, query or fragment.");
            }
            for (var address : java.net.InetAddress.getAllByName(host)) {
                if (address.isLoopbackAddress() || address.isAnyLocalAddress()) {
                    throw new IllegalArgumentException("Remote health endpoint must not resolve to agent loopback.");
                }
            }
        }
        HttpClient client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(2))
                .build();
        long deadline = System.nanoTime() + Duration.ofSeconds(40).toNanos();
        Exception lastFailure = null;

        while (System.nanoTime() < deadline) {
            try {
                HttpRequest request = HttpRequest.newBuilder(endpoint)
                        .timeout(Duration.ofSeconds(2))
                        .GET()
                        .build();
                HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
                if (response.statusCode() == 200 && response.body().contains("\"status\":\"UP\"")) {
                    System.out.println("HealthyLife smoke test passed"
                            + (remote ? " for configured remote endpoint." : ": " + endpoint));
                    return;
                }
                throw new IllegalStateException("Health endpoint returned HTTP " + response.statusCode());
            } catch (Exception exception) {
                lastFailure = exception;
                Thread.sleep(1000);
            }
        }

        throw new IllegalStateException("HealthyLife did not become healthy before the smoke-test timeout.", lastFailure);
    }
}
