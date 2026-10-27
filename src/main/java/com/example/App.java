package com.example;
public class App {
    public String greet(String name) {
        if (name == null || name.isBlank()) return "Hello, Jenkins!";
        return "Hello, " + name.trim() + "!";
    }
    public static void main(String[] args) {
        String name = args.length > 0 ? args[0] : "Jenkins";
        System.out.println(new App().greet(name));
    }
}
