package com.example.healthylife.service;

import com.example.healthylife.api.BmiRequest;
import com.example.healthylife.api.BmiResponse;
import com.example.healthylife.api.WeightPlanRequest;
import com.example.healthylife.api.WeightPlanResponse;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class HealthCalculationServiceTest {
    private final HealthCalculationService service = new HealthCalculationService();

    @Test
    void calculatesAndRoundsBmi() {
        BmiResponse result = service.calculateBmi(new BmiRequest(170.0, 68.0));

        assertEquals(23.5, result.bmi());
        assertEquals("Normal range", result.category());
        assertTrue(result.screeningMeasure());
    }

    @Test
    void assignsAdultCategoriesAtExactThresholds() {
        assertEquals("Underweight", service.calculateBmi(new BmiRequest(100.0, 18.49)).category());
        assertEquals("Normal range", service.calculateBmi(new BmiRequest(100.0, 18.5)).category());
        assertEquals("Normal range", service.calculateBmi(new BmiRequest(100.0, 24.99)).category());
        assertEquals("Overweight", service.calculateBmi(new BmiRequest(100.0, 25.0)).category());
        assertEquals("Overweight", service.calculateBmi(new BmiRequest(100.0, 29.99)).category());
        assertEquals("Obesity range", service.calculateBmi(new BmiRequest(100.0, 30.0)).category());
    }

    @Test
    void calculatesWeightDifferenceAndConservativeEstimate() {
        WeightPlanResponse result = service.createWeightPlan(
                new WeightPlanRequest(170.0, 80.0, 70.0, null));

        assertEquals(10.0, result.weightDifferenceKg());
        assertEquals(-10.0, result.weightChangeKg());
        assertEquals(Integer.valueOf(20), result.estimatedWeeksMin());
        assertEquals(Integer.valueOf(40), result.estimatedWeeksMax());
        assertTrue(result.safeToPursue());
    }

    @Test
    void warnsForUnderweightTargetAndDoesNotEstimate() {
        WeightPlanResponse result = service.createWeightPlan(
                new WeightPlanRequest(170.0, 70.0, 50.0, null));

        assertFalse(result.safeToPursue());
        assertTrue(result.safetyMessage().contains("below the general adult BMI range"));
        assertNull(result.estimatedWeeksMin());
        assertNull(result.estimatedWeeksMax());
    }

    @Test
    void doesNotAllowTargetBelowThresholdWhenDisplayedBmiRoundsUp() {
        WeightPlanResponse result = service.createWeightPlan(
                new WeightPlanRequest(200.0, 80.0, 73.96, null));

        assertEquals(18.5, result.targetBmi());
        assertEquals("Underweight", result.targetCategory());
        assertFalse(result.safeToPursue());
    }

    @Test
    void doesNotEncourageWeightLossWhenCurrentBmiIsUnderweight() {
        WeightPlanResponse result = service.createWeightPlan(
                new WeightPlanRequest(170.0, 52.0, 50.0, null));

        assertFalse(result.safeToPursue());
        assertTrue(result.safetyMessage().contains("does not encourage further weight loss"));
    }
}
