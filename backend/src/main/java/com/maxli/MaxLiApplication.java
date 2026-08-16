package com.maxli;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class MaxLiApplication {

    public static void main(String[] args) {
        SpringApplication.run(MaxLiApplication.class, args);
    }
}
