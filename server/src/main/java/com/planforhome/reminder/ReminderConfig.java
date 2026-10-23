package com.planforhome.reminder;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Turns on the scheduler that runs {@link ReminderJob}. */
@Configuration
@EnableScheduling
public class ReminderConfig {}
