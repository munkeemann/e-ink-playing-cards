plugins {
    id("com.android.application")
    kotlin("android")
    alias(libs.plugins.kotlin.compose)
}

android {
    namespace = "com.example.androidapp"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.example.androidapp"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    buildFeatures {
        compose = true
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    packaging {
        resources {
            excludes += "META-INF/DEPENDENCIES"
        }
    }

    kotlin {
        jvmToolchain(17)
    }
}

dependencies {

    //Wifi???
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    // Drag and drop reordering
    implementation("sh.calvin.reorderable:reorderable:2.1.1")
    //AI Integration
    implementation("com.anthropic:anthropic-java:2.16.1")
    // Core libs
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.6.2")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")

    // JSON handling
    implementation("org.json:json:20231013")
    implementation("com.google.code.gson:gson:2.10.1")

    // Image loading
    implementation("io.coil-kt:coil-compose:2.4.0")

    // Navigation
    implementation("androidx.navigation:navigation-compose:2.7.5")

    // Material Design
    implementation("com.google.android.material:material:1.11.0")

    // Compose BOM (version aligned)
    implementation(platform("androidx.compose:compose-bom:2024.01.00"))

    // Compose core modules
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.activity:activity-compose:1.8.2")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material:material")
    implementation("androidx.compose.material3:material3:1.1.2")
    implementation("androidx.compose.ui:ui-tooling-preview")
    debugImplementation("androidx.compose.ui:ui-tooling")

    // Compose runtime
    implementation("androidx.compose.runtime:runtime")
    implementation("androidx.compose.runtime:runtime-livedata")
}
