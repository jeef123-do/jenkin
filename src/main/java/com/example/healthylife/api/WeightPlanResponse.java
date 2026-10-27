package com.example.healthylife.api;

import java.time.LocalDate;

public record WeightPlanResponse(
        double currentBmi,
        String currentCategory,
        double targetBmi,
        String targetCategory,
        double weightDifferenceKg,
        double weightChangeKg,
        boolean safeToPursue,
        String safetyMessage,
        Integer estimatedWeeksMin,
        Integer estimatedWeeksMax,
        LocalDate targetDate) {
}
