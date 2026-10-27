package com.example.healthylife.api;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record WeightPlanRequest(
        @NotNull(message = "Height is required.")
        @DecimalMin(value = "50.0", message = "Height must be at least 50 cm.")
        @DecimalMax(value = "250.0", message = "Height must be no more than 250 cm.")
        Double heightCm,
        @NotNull(message = "Current weight is required.")
        @DecimalMin(value = "20.0", message = "Current weight must be at least 20 kg.")
        @DecimalMax(value = "500.0", message = "Current weight must be no more than 500 kg.")
        Double currentWeightKg,
        @NotNull(message = "Target weight is required.")
        @DecimalMin(value = "20.0", message = "Target weight must be at least 20 kg.")
        @DecimalMax(value = "500.0", message = "Target weight must be no more than 500 kg.")
        Double targetWeightKg,
        LocalDate targetDate) {
}
