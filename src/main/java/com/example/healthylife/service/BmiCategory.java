package com.example.healthylife.service;

public enum BmiCategory {
    UNDERWEIGHT("Underweight", "Below the general adult healthy range."),
    NORMAL_RANGE("Normal range", "Within the general adult BMI range of 18.5 to below 25."),
    OVERWEIGHT("Overweight", "Above the general adult BMI range; BMI alone cannot assess health."),
    OBESITY_RANGE("Obesity range", "BMI is a screening measure and does not diagnose a health condition.");

    private final String label;
    private final String explanation;

    BmiCategory(String label, String explanation) {
        this.label = label;
        this.explanation = explanation;
    }

    public String label() {
        return label;
    }

    public String explanation() {
        return explanation;
    }
}
