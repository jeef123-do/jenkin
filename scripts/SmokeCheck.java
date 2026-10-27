import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

public class SmokeCheck {
    public static void main(String[] args) throws Exception {
        URI endpoint = URI.create(args[0]);
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
                    System.out.println("HealthyLife smoke test passed: " + endpoint);
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
