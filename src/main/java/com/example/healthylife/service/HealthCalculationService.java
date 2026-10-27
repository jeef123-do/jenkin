package com.example.healthylife.service;

import com.example.healthylife.api.BmiRequest;
import com.example.healthylife.api.BmiResponse;
import com.example.healthylife.api.WeightPlanRequest;
import com.example.healthylife.api.WeightPlanResponse;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Service
public class HealthCalculationService {
    public BmiResponse calculateBmi(BmiRequest request) {
        double exactBmi = bmiValue(request.weightKg(), request.heightCm());
        BmiCategory category = categoryFor(exactBmi);
        return new BmiResponse(round(exactBmi), category.label(), category.explanation(), true);
    }

    public WeightPlanResponse createWeightPlan(WeightPlanRequest request) {
        double exactCurrentBmi = bmiValue(request.currentWeightKg(), request.heightCm());
        double exactTargetBmi = bmiValue(request.targetWeightKg(), request.heightCm());
        double currentBmi = round(exactCurrentBmi);
        double targetBmi = round(exactTargetBmi);
        double weightChange = round(request.targetWeightKg() - request.currentWeightKg());
        BmiCategory currentCategory = categoryFor(exactCurrentBmi);
        BmiCategory targetCategory = categoryFor(exactTargetBmi);

        String safetyMessage = null;
        if (exactCurrentBmi < 18.5 && weightChange < 0) {
            safetyMessage = "Your current BMI is below the general adult range. This planner does not encourage further weight loss; consider speaking with a healthcare professional.";
        } else if (exactTargetBmi < 18.5) {
            safetyMessage = "This target is below the general adult BMI range. Consider discussing a suitable goal with a healthcare professional.";
        }

        boolean safeToPursue = safetyMessage == null;
        Integer estimatedWeeksMin = null;
        Integer estimatedWeeksMax = null;
        if (safeToPursue && weightChange < 0) {
            double kilogramsToLose = Math.abs(weightChange);
            estimatedWeeksMin = (int) Math.ceil(kilogramsToLose / 0.5);
            estimatedWeeksMax = (int) Math.ceil(kilogramsToLose / 0.25);
        }

        return new WeightPlanResponse(
                currentBmi,
                currentCategory.label(),
                targetBmi,
                targetCategory.label(),
                round(Math.abs(weightChange)),
                weightChange,
                safeToPursue,
                safetyMessage,
                estimatedWeeksMin,
                estimatedWeeksMax,
                request.targetDate());
    }

    private double bmiValue(double weightKg, double heightCm) {
        double heightMeters = heightCm / 100.0;
        return weightKg / (heightMeters * heightMeters);
    }

    private BmiCategory categoryFor(double bmi) {
        if (bmi < 18.5) {
            return BmiCategory.UNDERWEIGHT;
        }
        if (bmi < 25.0) {
            return BmiCategory.NORMAL_RANGE;
        }
        if (bmi < 30.0) {
            return BmiCategory.OVERWEIGHT;
        }
        return BmiCategory.OBESITY_RANGE;
    }

    private double round(double value) {
        return BigDecimal.valueOf(value).setScale(1, RoundingMode.HALF_UP).doubleValue();
    }
}
