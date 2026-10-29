import org.codehaus.groovy.control.CompilerConfiguration
import org.codehaus.groovy.control.CompilationUnit
import org.codehaus.groovy.control.Phases

class MockPipeline extends Script {
    Map scenario
    List commands = []
    List stagesSeen = []
    Map posts = [:]
    boolean collectingPost = false
    boolean enabled = true
    boolean injected = false
    RuntimeException stageFailure
    def run() {}
    def methodMissing(String name, args) {
        if (collectingPost && name in ['always', 'success', 'failure', 'cleanup']) {
            posts[name] = args[0]
            return
        }
        if (name == 'post') {
            collectingPost = true
            args[0].call()
            collectingPost = false
        } else if (name == 'stage') {
            if (stageFailure != null) { return }
            boolean before = enabled
            enabled = true
            stagesSeen << args[0]
            try {
                args[1].call()
            } catch (RuntimeException failure) {
                stageFailure = failure
                binding.currentBuild.currentResult = 'FAILURE'
            } finally {
                enabled = before
            }
        } else if (name == 'expression') {
            enabled = args[0].call()
        } else if (name in ['steps', 'options']) {
            if (enabled && args[-1] instanceof Closure) { args[-1].call() }
        } else if (args && args[-1] instanceof Closure) {
            args[-1].call()
        }
    }
    def sh(String command) {
        commands << command.trim()
        if (scenario.unstable && command.contains('security-scan.sh')) {
            binding.currentBuild.currentResult = 'UNSTABLE'
        }
        if (!injected && scenario.fail && command.contains(scenario.fail)) {
            injected = true
            throw new RuntimeException("Mock command failed")
        }
    }
    def input(Map arguments) {
        assert arguments.submitter == 'release-manager'
        assert arguments.message.contains('local PRD simulation')
        assert arguments.message.contains('localhost:18083')
        commands << 'input'
        if (scenario.rejectApproval) { throw new RuntimeException('Mock approval aborted/timed out') }
    }
    def error(String message) { throw new RuntimeException(message) }
    def fileExists(String ignored) { true }
}

assert args.length == 0 : 'Feed this harness, a delimiter and Jenkinsfile through stdin.'
// The launcher supplies the current Jenkinsfile as a Base64 system property.
String source = new String(System.getProperty('healthylife.pipeline').decodeBase64(), 'UTF-8')
def unit = new CompilationUnit()
unit.addSource('Jenkinsfile', source)
unit.compile(Phases.CONVERSION)

def runCase = { Map scenario ->
    def binding = new Binding([
        params: [TARGET_ENV: scenario.target ?: 'TEST', SIMULATE_TEST_FAILURE: scenario.simulated ?: false],
        env: [JOB_NAME: 'mock-job', BUILD_NUMBER: '42'],
        currentBuild: [currentResult: 'SUCCESS'], scm: 'mock-scm'
    ])
    def configuration = new CompilerConfiguration(scriptBaseClass: MockPipeline.name)
    MockPipeline script = (MockPipeline) new GroovyShell(this.class.classLoader, binding, configuration).parse(source)
    script.setScenario(scenario)
    boolean failed = false
    String reason = ''
    try {
        script.run()
        if (script.getStageFailure() != null) { throw script.getStageFailure() }
    } catch (RuntimeException expected) {
        failed = true
        reason = expected.toString()
        binding.currentBuild.currentResult = 'FAILURE'
    } finally {
        try {
            script.posts.always?.call()
            script.posts[failed ? 'failure' : 'success']?.call()
        } finally {
            script.posts.cleanup?.call()
        }
    }
    [script: script, failed: failed, reason: reason]
}

int count = 0
['TEST', 'SIT', 'PRD'].each { target ->
    def result = runCase([target: target])
    assert !result.failed : result.reason
    def commands = result.script.commands
    int deploy = commands.findIndexOf { it.contains('deploy-test.sh') }
    int smoke = commands.findIndexOf { it.contains('smoke-test.sh TEST') }
    int cleanup = commands.findIndexOf { it.contains('test-environment.sh cleanup') }
    assert deploy >= 0 && smoke > deploy && cleanup > smoke
    assert commands.count { it.contains('test-environment.sh cleanup') } == 1
    assert !commands.any { it.contains('sit-environment.sh stop') || it.contains('compose down') }
    if (target == 'SIT') {
        assert commands.findIndexOf { it.contains('deploy-sit.sh') } > cleanup
        assert !commands.contains('input')
    } else if (target == 'PRD') {
        assert commands.indexOf('input') > cleanup
        assert commands.any { it.contains('deploy-prd.sh') }
        assert commands.findIndexOf { it.contains('deploy-prd.sh') } > commands.indexOf('input')
        assert !commands.any { it.contains('deploy-sit.sh') }
    }
    count++
}

def failedPrd = runCase([target: 'PRD', fail: 'deploy-prd.sh'])
assert failedPrd.failed
assert failedPrd.script.commands.count { it.contains('test-environment.sh cleanup') } == 1
assert !failedPrd.script.commands.any { it.contains('deploy-sit.sh') || it.contains('prd-environment.sh stop') }
count++

['TEST', 'SIT', 'PRD'].each { target ->
    ['clean compile', 'mvnw -B test', 'mvnw -B package', 'security-scan.sh',
     'deploy-test.sh', 'smoke-test.sh TEST', 'test-environment.sh cleanup'].each { failing ->
        def result = runCase([target: target, fail: failing])
        assert result.failed
        def commands = result.script.commands
        boolean temporaryAttempted = commands.any { it.contains('deploy-test.sh') }
        assert commands.count { it.contains('test-environment.sh cleanup') } ==
            (temporaryAttempted ? (failing == 'test-environment.sh cleanup' ? 2 : 1) : 0)
        assert !commands.any { it.contains('deploy-sit.sh') || it.contains('deploy-prd.sh') }
        assert !commands.contains('input')
        count++
    }
}
def aborted = runCase([target: 'PRD', rejectApproval: true])
assert aborted.failed
assert !aborted.script.commands.any { it.contains('deploy-prd.sh') || it.contains('deploy-sit.sh') }
count++
def simulated = runCase([simulated: true, fail: '-Ddemo.fail=true'])
assert simulated.failed
assert simulated.script.commands.any { it.contains('test -Ddemo.fail=true') }
assert !simulated.script.commands.any { it.contains('deploy-test.sh') }
count++
def failedSit = runCase([target: 'SIT', fail: 'deploy-sit.sh'])
assert failedSit.failed
assert failedSit.script.commands.count { it.contains('test-environment.sh cleanup') } == 1
assert !failedSit.script.commands.any { it.contains('deploy-prd.sh') || it.contains('sit-environment.sh stop') }
count++
['TEST', 'SIT', 'PRD'].each { target ->
    def unstable = runCase([target: target, unstable: true])
    assert unstable.failed
    assert !unstable.script.commands.any { it.contains('deploy-') || it == 'input' }
    count++
}
def invalid = runCase([target: 'INVALID'])
assert invalid.failed
assert invalid.script.commands.isEmpty()
count++
assert source.contains("agent { label 'healthylife-docker' }")
assert source.contains("TEST_PORT = '18081'")
assert source.contains('disableConcurrentBuilds()')
assert source.contains('disableRestartFromStage()')
assert source.contains('sha256sum --check target/artifact.sha256')
assert source.contains('cmp "$ARTIFACT_PATH" target/security-input/application.jar')
println "Groovy syntax and ${count} mocked pipeline cases passed (not Jenkins CPS/Declarative validation)."
