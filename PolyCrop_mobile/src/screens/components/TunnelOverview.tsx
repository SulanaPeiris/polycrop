import React from "react";
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/types";
import { Ionicons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");

export default function TunnelOverview({ tunnel }: any) {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

    if (!tunnel) {
        return (
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Select a tunnel to view details</Text>
            </View>
        );
    }

    // Mock data derivation if tunnel doesn't have it
    const temp = tunnel.sensors?.temp || 24;
    const humidity = tunnel.sensors?.humidity || 60;
    const isHealthy = tunnel.status === "GOOD";

    return (
        <View style={styles.container}>
            {/* Tunnel Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.tunnelName}>{tunnel.name}</Text>
                    <Text style={styles.location}>Cucumber</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: isHealthy ? "#E8F5E9" : "#FFEBEE" }]}>
                    <View style={[styles.statusDot, { backgroundColor: isHealthy ? "#4CAF50" : "#F44336" }]} />
                    <Text style={[styles.statusText, { color: isHealthy ? "#2E7D32" : "#D32F2F" }]}>
                        {isHealthy ? "GOOD" : "ATTENTION"}
                    </Text>
                </View>
            </View>


            {/* Environment Section */}
            <Text style={styles.sectionLabel}>ENVIRONMENT</Text>
            <View style={styles.envCard}>
                {/* Robot Status Badge */}
                <View style={styles.robotBadge}>
                    <Ionicons name="cube-outline" size={12} color="#1565C0" />
                    <Text style={styles.robotText}>Robot: Docked</Text>
                </View>

                <View style={styles.envRow}>
                    {/* Temperature */}
                    <View style={styles.envItem}>
                        <View style={[styles.iconCircle, { backgroundColor: "#FFF3E0" }]}>
                            <Ionicons name="thermometer-outline" size={24} color="#FF7043" />
                        </View>
                        <Text style={styles.envValue}>{temp}°C</Text>
                        <Text style={styles.envLabel}>Temperature</Text>
                    </View>

                    {/* Divider Line */}
                    <View style={styles.verticalDivider} />

                    {/* Humidity */}
                    <View style={styles.envItem}>
                        <View style={[styles.iconCircle, { backgroundColor: "#E3F2FD" }]}>
                            <Ionicons name="water-outline" size={24} color="#1E88E5" />
                        </View>
                        <Text style={styles.envValue}>{humidity}%</Text>
                        <Text style={styles.envLabel}>Humidity</Text>
                    </View>
                </View>
            </View>

            {/* Crop & Health Section */}
            <Text style={styles.sectionLabel}>CROP & HEALTH</Text>

            {/* Harvest Ready Card */}
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => navigation.navigate("HarvestReady")}
            >
                <View style={styles.infoCard}>
                    <View style={[styles.infoIconBox, { backgroundColor: "#FFF3E0" }]}>
                        <Ionicons name="basket" size={20} color="#EF6C00" />
                    </View>
                    <View style={styles.infoContent}>
                        <Text style={styles.infoTitle}>Harvest Ready</Text>
                        <Text style={styles.infoSubtitle}>12 Cucumbers available</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#BDBDBD" />
                </View>
            </TouchableOpacity>

            {/* Disease Risk Card */}
            <View style={styles.infoCard}>
                <View style={[styles.infoIconBox, { backgroundColor: "#E8F5E9" }]}>
                    <Ionicons name="alert-circle" size={20} color="#2E7D32" />
                </View>
                <View style={styles.infoContent}>
                    <Text style={styles.infoTitle}>Disease Risk: Low</Text>
                    <Text style={styles.infoSubtitle}>No issues detected</Text>
                </View>
            </View>

            {/* Fertigation Log Section */}
            <Text style={styles.sectionLabel}>RECENT FERTIGATION LOGS</Text>

            {/* Log 1 (Next) */}
            <View style={styles.fertigationCard}>
                <View style={styles.npkContainer}>
                    <View style={styles.npkItem}><View style={styles.npkCircle}><Text style={styles.npkValue}>20</Text></View><Text style={styles.npkLabel}>N</Text></View>
                    <View style={styles.npkItem}><View style={styles.npkCircle}><Text style={styles.npkValue}>20</Text></View><Text style={styles.npkLabel}>P</Text></View>
                    <View style={styles.npkItem}><View style={styles.npkCircle}><Text style={styles.npkValue}>20</Text></View><Text style={styles.npkLabel}>K</Text></View>
                </View>
                <View style={styles.scheduleContainer}>
                    <Text style={styles.scheduleLabel}>Next Schedule:</Text>
                    <Text style={styles.scheduleTime}>Watering at 4:00 PM</Text>
                </View>
            </View>

            {/* Log 2 (Past) */}
            <View style={styles.fertigationCard}>
                <View style={styles.npkContainer}>
                    <View style={styles.npkItem}><View style={styles.npkCircle}><Text style={styles.npkValue}>18</Text></View><Text style={styles.npkLabel}>N</Text></View>
                    <View style={styles.npkItem}><View style={styles.npkCircle}><Text style={styles.npkValue}>18</Text></View><Text style={styles.npkLabel}>P</Text></View>
                    <View style={styles.npkItem}><View style={styles.npkCircle}><Text style={styles.npkValue}>18</Text></View><Text style={styles.npkLabel}>K</Text></View>
                </View>
                <View style={styles.scheduleContainer}>
                    <Text style={styles.scheduleLabel}>Completed:</Text>
                    <Text style={styles.scheduleTime}>Yesterday, 4:00 PM</Text>
                </View>
            </View>

            {/* Log 3 (Past) */}
            <View style={styles.fertigationCard}>
                <View style={styles.npkContainer}>
                    <View style={styles.npkItem}><View style={styles.npkCircle}><Text style={styles.npkValue}>22</Text></View><Text style={styles.npkLabel}>N</Text></View>
                    <View style={styles.npkItem}><View style={styles.npkCircle}><Text style={styles.npkValue}>22</Text></View><Text style={styles.npkLabel}>P</Text></View>
                    <View style={styles.npkItem}><View style={styles.npkCircle}><Text style={styles.npkValue}>22</Text></View><Text style={styles.npkLabel}>K</Text></View>
                </View>
                <View style={styles.scheduleContainer}>
                    <Text style={styles.scheduleLabel}>Completed:</Text>
                    <Text style={styles.scheduleTime}>Jan 1, 4:00 PM</Text>
                </View>
            </View>

        </View >
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 20
    },
    emptyContainer: {
        padding: 20,
        alignItems: "center"
    },
    emptyText: {
        color: "#757575"
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 20
    },
    tunnelName: {
        fontSize: 22,
        fontWeight: "800",
        color: "#1B5E20"
    },
    location: {
        fontSize: 12,
        color: "#757575",
        marginTop: 2
    },
    statusBadge: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        gap: 6
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3
    },
    statusText: {
        fontSize: 11,
        fontWeight: "700",
        letterSpacing: 0.5
    },

    sectionLabel: {
        fontSize: 12,
        fontWeight: "700",
        color: "#888",
        marginBottom: 10,
        letterSpacing: 1,
        marginTop: 16
    },

    // Environment Card
    envCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        padding: 24,
        paddingTop: 32, // Space for badge
        marginBottom: 8,
        position: "relative",
        elevation: 2,
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 2 }
    },
    robotBadge: {
        position: "absolute",
        top: 12,
        right: 12,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#E3F2FD",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4
    },
    robotText: {
        fontSize: 11,
        color: "#1565C0",
        fontWeight: "700"
    },
    envRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 12,
    },
    envItem: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center"
    },
    iconCircle: {
        width: 50,
        height: 50,
        borderRadius: 25,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 12
    },
    envValue: {
        fontSize: 28,
        fontWeight: "800",
        color: "#333",
        marginBottom: 4
    },
    envLabel: {
        fontSize: 13,
        color: "#757575",
        fontWeight: "500"
    },
    verticalDivider: {
        width: 1,
        height: "70%",
        backgroundColor: "#EEEEEE"
    },

    // Info Cards (Crop & Health)
    infoCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        padding: 16,
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 12,
        elevation: 1,
        shadowColor: "#000",
        shadowOpacity: 0.03,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 2 }
    },
    infoIconBox: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 16
    },
    infoContent: {
        flex: 1
    },
    infoTitle: {
        fontSize: 15,
        fontWeight: "700",
        color: "#333",
        marginBottom: 2
    },
    infoSubtitle: {
        fontSize: 13,
        color: "#757575"
    },

    // Fertigation Card
    fertigationCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        padding: 16,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        elevation: 1,
        shadowColor: "#000",
        shadowOpacity: 0.03,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 2 },
        marginBottom: 12,
    },
    npkContainer: {
        flexDirection: "row",
        gap: 12
    },
    npkItem: {
        alignItems: "center",
        gap: 4
    },
    npkCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: "#81C784", // Light Green Border
        backgroundColor: "#F1F8E9", // Very light green fill
        alignItems: "center",
        justifyContent: "center"
    },
    npkValue: {
        fontSize: 14,
        fontWeight: "800",
        color: "#2E7D32"
    },
    npkLabel: {
        fontSize: 11,
        color: "#757575",
        fontWeight: "600"
    },
    scheduleContainer: {
        alignItems: "flex-end"
    },
    scheduleLabel: {
        fontSize: 12,
        color: "#9E9E9E",
        marginBottom: 4
    },
    scheduleTime: {
        fontSize: 16,
        fontWeight: "800",
        color: "#333"
    }

});
