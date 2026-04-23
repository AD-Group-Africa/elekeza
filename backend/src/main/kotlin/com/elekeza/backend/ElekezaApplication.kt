package com.elekeza.backend

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import org.springframework.scheduling.annotation.EnableAsync

@SpringBootApplication
@EnableAsync
class ElekzaApplication

fun main(args: Array<String>) {
    runApplication<ElekzaApplication>(*args)
}