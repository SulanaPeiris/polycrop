import React, { useEffect } from "react";
import { View, Image, StyleSheet, ActivityIndicator } from "react-native";

export default function LoadingScreen() {
    return (
        <View style={styles.container}>
            <Image
                source={require("../../assets/icon.png")}
                style={styles.logo}
                resizeMode="contain"
            />
            <ActivityIndicator size="large" color="#2E7D32" style={styles.loader} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F8F9FA",
        justifyContent: "center",
        alignItems: "center",
    },
    logo: {
        width: 120,
        height: 120,
        marginBottom: 24,
        borderRadius: 24,
    },
    loader: {
        marginTop: 20
    }
});
