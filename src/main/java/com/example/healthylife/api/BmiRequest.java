package com.example.healthylife.api;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

public record BmiRequest(
        @NotNull(message = "Height is required.")
        @DecimalMin(value = "50.0", message = "Height must be at least 50 cm.")
        @DecimalMax(value = "250.0", message = "Height must be no more than 250 cm.")
        Double heightCm,
        @NotNull(message = "Weight is required.")
        @DecimalMin(value = "20.0", message = "Weight must be at least 20 kg.")
        @DecimalMax(value = "500.0", message = "Weight must be no more than 500 kg.")
        Double weightKg) {
}
