package com.example.healthylife.api;

public record BmiResponse(
        double bmi,
        String category,
        String explanation,
        boolean screeningMeasure) {
}
