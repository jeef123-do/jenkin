package com.example.healthylife.api;

import com.example.healthylife.service.HealthCalculationService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class HealthController {
    private final HealthCalculationService calculationService;

    public HealthController(HealthCalculationService calculationService) {
        this.calculationService = calculationService;
    }

    @GetMapping("/health")
    public HealthResponse health() {
        return new HealthResponse("UP");
    }

    @PostMapping("/bmi/calculate")
    public BmiResponse calculateBmi(@Valid @RequestBody BmiRequest request) {
        return calculationService.calculateBmi(request);
    }

    @PostMapping("/weight/plan")
    public WeightPlanResponse createWeightPlan(@Valid @RequestBody WeightPlanRequest request) {
        return calculationService.createWeightPlan(request);
    }
}
