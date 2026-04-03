import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import authService from "../services/authService";

const LoginScreen = ({ onLoginSuccess }) => {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: null,
      }));
    }
  };

  const validateForm = () => {
    const { username, email, password, confirmPassword } = formData;
    const newErrors = {};

    if (!username.trim()) {
      newErrors.username = "Username is required";
      Alert.alert(
        "Validation Error",
        "Username is required. Please enter your username.",
      );
    }

    if (!isLogin && !email.trim()) {
      newErrors.email = "Email is required";
      Alert.alert(
        "Validation Error",
        "Email address is required for registration.",
      );
    } else if (!isLogin && !email.includes("@")) {
      newErrors.email = "Invalid email format";
      Alert.alert(
        "Validation Error",
        "Please enter a valid email address (example: user@email.com).",
      );
    }

    if (!password.trim()) {
      newErrors.password = "Password is required";
      Alert.alert(
        "Validation Error",
        "Password is required. Please enter your password.",
      );
    } else if (password.length < 6) {
      newErrors.password = "Password too short";
      Alert.alert(
        "Validation Error",
        "Password must be at least 6 characters long for security.",
      );
    }

    if (!isLogin && password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords don't match";
      Alert.alert(
        "Validation Error",
        "Passwords do not match. Please make sure both password fields are identical.",
      );
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const { username, email, password } = formData;
      let result;

      if (isLogin) {
        result = await authService.login(username, password);
      } else {
        result = await authService.register(username, email, password);
      }

      if (result.success) {
        // Call onLoginSuccess immediately to update the app state
        onLoginSuccess(result.user);

        // Show success message without blocking the login flow
        setTimeout(() => {
          Alert.alert(
            "Success!",
            isLogin ? "Welcome back!" : "Account created successfully!",
          );
        }, 100);
      } else {
        // Show specific error messages based on the error type
        const errorTitle = isLogin ? "Login Failed" : "Registration Failed";
        Alert.alert(errorTitle, result.error);
      }
    } catch (error) {
      console.error("Login/Register error:", error);
      const errorTitle = isLogin ? "Login Error" : "Registration Error";
      Alert.alert(
        errorTitle,
        "Something went wrong. Please check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
    });
    setErrors({});
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    resetForm();
  };

  return (
    <SafeAreaProvider>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContainer,
            { paddingHorizontal: isMobile ? 20 : 40 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.formContainer,
              { maxWidth: isMobile ? "100%" : 400 },
            ]}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>
                {isLogin ? "🌸 Welcome Back!" : "🌸 Join Us!"}
              </Text>
              <Text style={styles.subtitle}>
                {isLogin
                  ? "Sign in to access your Pokemon card wishlist"
                  : "Create your account to start collecting"}
              </Text>
            </View>

            {/* Form */}
            <View style={styles.form}>
              {/* Username */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Username</Text>
                <TextInput
                  style={[styles.input, errors.username && styles.inputError]}
                  value={formData.username}
                  onChangeText={(value) => handleInputChange("username", value)}
                  placeholder="Enter your username"
                  placeholderTextColor="#d1a3d1"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {errors.username && (
                  <Text style={styles.errorText}>{errors.username}</Text>
                )}
              </View>

              {/* Email (only for register) */}
              {!isLogin && (
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Email</Text>
                  <TextInput
                    style={[styles.input, errors.email && styles.inputError]}
                    value={formData.email}
                    onChangeText={(value) => handleInputChange("email", value)}
                    placeholder="Enter your email"
                    placeholderTextColor="#d1a3d1"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {errors.email && (
                    <Text style={styles.errorText}>{errors.email}</Text>
                  )}
                </View>
              )}

              {/* Password */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  style={[styles.input, errors.password && styles.inputError]}
                  value={formData.password}
                  onChangeText={(value) => handleInputChange("password", value)}
                  placeholder="Enter your password"
                  placeholderTextColor="#d1a3d1"
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {errors.password && (
                  <Text style={styles.errorText}>{errors.password}</Text>
                )}
              </View>

              {/* Confirm Password (only for register) */}
              {!isLogin && (
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Confirm Password</Text>
                  <TextInput
                    style={[
                      styles.input,
                      errors.confirmPassword && styles.inputError,
                    ]}
                    value={formData.confirmPassword}
                    onChangeText={(value) =>
                      handleInputChange("confirmPassword", value)
                    }
                    placeholder="Confirm your password"
                    placeholderTextColor="#d1a3d1"
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {errors.confirmPassword && (
                    <Text style={styles.errorText}>
                      {errors.confirmPassword}
                    </Text>
                  )}
                </View>
              )}

              {/* Submit Button */}
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  loading && styles.submitButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={loading}
              >
                <Text style={styles.submitButtonText}>
                  {loading
                    ? "⏳ Please wait..."
                    : isLogin
                      ? "🚀 Sign In"
                      : "✨ Create Account"}
                </Text>
              </TouchableOpacity>

              {/* Toggle Mode */}
              <View style={styles.toggleContainer}>
                <Text style={styles.toggleText}>
                  {isLogin
                    ? "Don't have an account? "
                    : "Already have an account? "}
                </Text>
                <TouchableOpacity onPress={toggleMode}>
                  <Text style={styles.toggleLink}>
                    {isLogin ? "Sign Up" : "Sign In"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                🔒 Your data is stored securely on your device
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fef7f7",
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    paddingVertical: 40,
  },
  formContainer: {
    alignSelf: "center",
    width: "100%",
  },
  header: {
    alignItems: "center",
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#8b5a8c",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#a569a6",
    textAlign: "center",
    lineHeight: 24,
  },
  form: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 24,
    shadowColor: "#f4c2c2",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#8b5a8c",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#fef7f7",
    borderWidth: 2,
    borderColor: "#f4c2c2",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#333",
    minHeight: 48,
  },
  submitButton: {
    backgroundColor: "#f8bbd9",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 10,
    shadowColor: "#f4c2c2",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  submitButtonDisabled: {
    backgroundColor: "#e0e0e0",
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  toggleContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 24,
    flexWrap: "wrap",
  },
  toggleText: {
    color: "#666",
    fontSize: 14,
  },
  toggleLink: {
    color: "#f8bbd9",
    fontSize: 14,
    fontWeight: "bold",
  },
  footer: {
    alignItems: "center",
    marginTop: 32,
  },
  footerText: {
    color: "#999",
    fontSize: 12,
    textAlign: "center",
  },
  inputError: {
    borderColor: "#ff6b6b",
    borderWidth: 2,
    backgroundColor: "#fff5f5",
  },
  errorText: {
    color: "#ff6b6b",
    fontSize: 12,
    marginTop: 4,
    fontWeight: "500",
  },
});

export default LoginScreen;
