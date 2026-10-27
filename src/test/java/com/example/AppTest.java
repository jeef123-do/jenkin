package com.example;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
class AppTest {
    @Test void greetsName() { assertEquals("Hello, Team!", new App().greet("Team")); }
    @Test void defaultsForBlankName() { assertEquals("Hello, Jenkins!", new App().greet("  ")); }
    @Test void optionalFailureForLiveDemo() {
        if (Boolean.getBoolean("demo.fail")) assertTrue(false, "Intentional failure for Jenkins demo");
        assertTrue(true);
    }
}
