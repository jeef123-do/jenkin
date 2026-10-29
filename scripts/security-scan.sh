#!/bin/sh
set -eu

version=0.76.1
jar=target/jenkins-java-maven-demo-1.0.0.jar
reports=target/security
: "${HOME:?A persistent writable HOME is required}"
cache="$HOME/.cache/healthylife-trivy"

fail() {
    echo "HealthyLife security scan: $*" >&2
    exit 1
}

[ "$(uname -s)" = Linux ] || fail "A Linux Jenkins agent is required."
case "$(uname -m)" in
    x86_64) arch=64bit ;;
    aarch64|arm64) arch=ARM64 ;;
    *) fail "Unsupported Trivy release architecture: $(uname -m)" ;;
esac
for tool in curl sha256sum tar awk grep mktemp wc; do
    command -v "$tool" > /dev/null || fail "Missing agent tool: $tool"
done
[ -f "$jar" ] || fail "Packaged JAR not found. Package must succeed first."
mkdir -p "$cache" "$reports"
install="$cache/tools/$version-$arch"
if [ ! -x "$install/trivy" ] || [ ! -f "$install/contrib/html.tpl" ]; then
    temporary=$(mktemp -d "$cache/install-XXXXXXXX")
    trap 'rm -rf -- "$temporary"' EXIT
    trap 'exit 1' HUP INT TERM
    asset="trivy_${version}_Linux-${arch}.tar.gz"
    base="https://github.com/aquasecurity/trivy/releases/download/v$version"
    echo "Downloading pinned Trivy $version ($arch) and verifying release checksum."
    curl --fail --location --silent --show-error --retry 3 --connect-timeout 20 \
        --max-time 300 "$base/$asset" -o "$temporary/$asset"
    curl --fail --location --silent --show-error --retry 3 --connect-timeout 20 \
        --max-time 120 "$base/trivy_${version}_checksums.txt" -o "$temporary/checksums"
    awk -v asset="$asset" '$2 == asset { print }' "$temporary/checksums" > "$temporary/selected.sha256"
    [ "$(wc -l < "$temporary/selected.sha256")" -eq 1 ] || fail "Release checksum missing or ambiguous."
    (cd "$temporary" && sha256sum --check selected.sha256)
    tar -xzf "$temporary/$asset" -C "$temporary" trivy contrib/html.tpl
    mkdir -p "$install/contrib"
    cp "$temporary/contrib/html.tpl" "$install/contrib/html.tpl"
    mv "$temporary/trivy" "$install/trivy"
fi
trivy="$install/trivy"
"$trivy" --version
"$trivy" --version | grep -Fx "Version: $version" > /dev/null ||
    fail "Installed Trivy version does not match $version."
echo "Scanning deployed runtime dependencies; Trivy vulnerability and Java DBs use $cache/db."
mkdir -p target/security-input
cp "$jar" target/security-input/application.jar
# Generate all reports before evaluating the gate so blocked builds retain evidence.
"$trivy" rootfs --cache-dir "$cache/db" --timeout 20m --scanners vuln \
    --list-all-pkgs --format json --output "$reports/trivy.json" \
    --exit-code 0 --ignorefile /dev/null target/security-input
"$trivy" convert --format template \
    --template '{{range .}}{{range .Packages}}{{println .Name}}{{end}}{{end}}' \
    --output "$reports/packages.txt" "$reports/trivy.json"
grep -F 'spring-boot' "$reports/packages.txt" > /dev/null ||
    fail "Expected Spring Boot dependencies were not detected; refusing an empty or incomplete scan."
"$trivy" convert --format template --template "@$install/contrib/html.tpl" \
    --output "$reports/trivy.html" "$reports/trivy.json"
"$trivy" convert --format table --output "$reports/trivy.txt" "$reports/trivy.json"
cat "$reports/trivy.txt"
echo "Security gate: fail on HIGH or CRITICAL, including findings without a fix."
"$trivy" convert --format table --ignorefile /dev/null \
    --severity HIGH,CRITICAL --exit-code 1 "$reports/trivy.json"
