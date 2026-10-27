package com.example.healthylife.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class HealthApiTest {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void healthEndpointReportsUp() throws Exception {
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    void bmiEndpointCalculatesValidRequest() throws Exception {
        mockMvc.perform(post("/api/bmi/calculate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("heightCm", 170, "weightKg", 68))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bmi").value(23.5))
                .andExpect(jsonPath("$.category").value("Normal range"));
    }

    @Test
    void bmiEndpointUsesExactAdultCategoryBoundaries() throws Exception {
        double[] bmis = {18.49, 18.5, 24.99, 25.0, 29.99, 30.0};
        String[] categories = {
                "Underweight", "Normal range", "Normal range",
                "Overweight", "Overweight", "Obesity range"
        };
        double heightCm = 200.0;
        for (int index = 0; index < bmis.length; index++) {
            mockMvc.perform(post("/api/bmi/calculate")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(Map.of(
                                    "heightCm", heightCm,
                                    "weightKg", bmis[index] * Math.pow(heightCm / 100.0, 2)))))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.category").value(categories[index]));
        }
    }

    @Test
    void invalidBmiRequestReturnsStructuredValidationError() throws Exception {
        mockMvc.perform(post("/api/bmi/calculate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("heightCm", 0, "weightKg", -2))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.message").value("Request validation failed."))
                .andExpect(jsonPath("$.path").value("/api/bmi/calculate"))
                .andExpect(jsonPath("$.details.heightCm", containsString("at least 50 cm")))
                .andExpect(jsonPath("$.details.weightKg", containsString("at least 20 kg")));
    }

    @Test
    void missingBmiValuesReturnBadRequest() throws Exception {
        mockMvc.perform(post("/api/bmi/calculate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"weightKg\":68}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.details.heightCm").value("Height is required."));
    }

    @Test
    void nonFiniteBmiValuesReturnBadRequest() throws Exception {
        for (String invalidHeight : new String[] {"NaN", "Infinity", "-Infinity"}) {
            mockMvc.perform(post("/api/bmi/calculate")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"heightCm\":\"" + invalidHeight + "\",\"weightKg\":68}"))
                    .andExpect(status().isBadRequest());
        }
    }

    @Test
    void weightEndpointReturnsSafeTargetWarning() throws Exception {
        mockMvc.perform(post("/api/weight/plan")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "heightCm", 170, "currentWeightKg", 70, "targetWeightKg", 50))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.safeToPursue").value(false))
                .andExpect(jsonPath("$.estimatedWeeksMin").doesNotExist())
                .andExpect(jsonPath("$.safetyMessage", containsString("below the general adult BMI range")));
    }

    @Test
    void invalidWeightPlanReturnsBadRequest() throws Exception {
        mockMvc.perform(post("/api/weight/plan")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "heightCm", 0, "currentWeightKg", 70, "targetWeightKg", 60))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.details.heightCm", containsString("at least 50 cm")));
    }

    @Test
    void optionalDemoFailureCanBeTriggeredForJenkinsPresentation() {
        if (Boolean.getBoolean("demo.fail")) {
            throw new AssertionError("Intentional failure for Jenkins CI demonstration.");
        }
    }
}
