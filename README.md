# 🌱 LoRa-Enabled Smart Polytunnel Management System for Cucumber Farming

## 📌 Project Overview

This repository contains the implementation of a **LoRa-enabled smart polytunnel management system** designed for **precision cucumber farming** under Sri Lankan polytunnel conditions.

The system integrates **IoT-based sensor monitoring, AI-powered computer vision, robotic automation, and smart fertigation** to continuously monitor plant health, detect diseases, and automatically perform **targeted spraying and adaptive nutrient delivery**.

The solution is optimized for **low-power, long-range operation**, making it suitable for rural and large-scale polytunnels where stable internet connectivity is limited.

---

## 🎯 Project Objectives

- Enable **real-time environmental and soil monitoring** using LoRa communication
- Detect **cucumber growth stages** (flowering & fruiting) using computer vision
- Identify **downy mildew, powdery mildew, and water stress conditions** at early stages
- Perform **targeted fungicide spraying** only when disease is detected
- Implement **smart fertigation scheduling** based on flowering and fruiting stages
- Detect riped cucumbers by computer vision to improve harvest
- Reduce water, fertilizer, and chemical wastage through **precision automation**

---

## 🧠 System Architecture (High Level)

The system operates as a closed-loop smart agriculture platform consisting of:

1. **LoRa Sensor Monitoring Network**
2. **Line-Guided Camera Robot Module**
3. **AI Vision & Decision Engine**
4. **Smart Fertigation & Spraying Control Unit**
5. **Farmer Monitoring Dashboard (Mobile)**

<img width="1239" height="980" alt="image" src="https://github.com/user-attachments/assets/97423b4a-2dbc-4fec-a46c-b3f7ee97bddf" />


---

## 🚀 Key Features

### 🔗 LoRa-Enabled Sensor Monitoring
- Long-range, low-power LoRa communication
- Continuous monitoring of:
  - Temperature 
  - Humidity
- Designed for large polytunnels with minimal connectivity

---

### 🤖 Camera Robot Module (Vision Backbone)
- Line-guided robotic system for stable navigation inside narrow polytunnels
- Vertical lift and tilt camera mechanism and detect leaves
- Captures multi-angle images covering:
  - Top, middle, and bottom of cucumber plants
- Serves as the **primary platform for all image-based detections**

---

### 🍃 Disease & Stress Detection
Computer vision models detect:
- **Downy Mildew**
- **Powdery Mildew**
- **Water Stress Conditions**

Features:
- Early-stage symptom identification
- Leaf-level localization using deep learning

---

### 💦 Targeted Fungicide Spraying
- Sprayer mounted near the camera head
- Activated **only when disease is confirmed**
- Leaf-level, precision spraying
- Reduces:
  - Chemical usage
  - Environmental impact
  - Manual labor

Detection → Decision → Spray is fully automated.

---

### 🌱 Smart Fertigation System
- Integrates:
  - Sensor data
  - Growth stage (flowering & fruiting)
  - Crop nutrition logic
- Automatically adjusts:
  - Water volume
  - NPK nutrient ratios
- Example behavior:
  - Increased potassium during fruiting
  - Optimized nitrogen during vegetative growth
- Replaces fixed schedules with **dynamic, crop-aware fertigation**

---

### 📊 Farmer Dashboard (Mobile App)
- Real-time visualization of:
  - Sensor readings
  - Disease alerts with plant indexes
  - Fertigation and spraying history
- Simple and farmer-friendly interface

---

## 🛠️ Technology Stack

### Hardware
- LoRa sensor nodes
- Arduino / ESP-based controllers
- Line-guided robotic platform
- Camera with lift & tilt mechanism
- Automated sprayer and fertigation units

### Software
- Python (AI, image processing, backend logic)
- YOLO / CNN-based computer vision models
- IoT backend for LoRa data ingestion
- Mobile dashboards implemented with react native

---

## 🌍 Target Users
- Cucumber farmers using polytunnels
- Protected agriculture operators
- Agricultural researchers
- Smart farming solution developers

---

## 📈 Expected Impact
- Early disease detection and prevention
- Reduced fungicide and fertilizer usage
- Improved cucumber yield and quality
- Lower labor dependency
- Sustainable and scalable smart agriculture solution for Sri Lanka

---

## 📄 Research Foundation

This project is based on multiple undergraduate research components covering:
- Precision fertigation and nutrient planning
- Computer vision-based disease and stress detection
- Line-guided agricultural robotics
- LoRa-enabled agricultural IoT systems

---

## 📌 Project Status

🚧 **Ongoing Research & Development**

Modules are being developed, integrated, and validated inside real cucumber polytunnels under Sri Lankan farming conditions.

---

## 🤝 Contributions

This repository is part of an academic research project.  
Contributions, suggestions, and improvements are welcome via issues or pull requests.

---

## 📜 License

This project is intended for **academic and research purposes**.  
Licensing details will be added upon project completion.
