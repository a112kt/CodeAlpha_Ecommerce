const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const generateToken = require("../utils/generateToken");

// ─── Helper: Normalize Egyptian phone numbers ───────────────────────────────
// Input formats accepted: 01000000000, +201000000000, 00201000000000
// Output format: 01000000000 (always 11 digits starting with 01)
const normalizePhone = (phone) => {
  if (!phone) return null;
  let cleaned = phone.replace(/[\s\-()]/g, "");

  // Remove leading +20 or 0020
  if (cleaned.startsWith("+20")) {
    cleaned = cleaned.slice(3);
  } else if (cleaned.startsWith("0020")) {
    cleaned = cleaned.slice(4);
  }

  // Remove leading 2 if already stripped prefix but has extra 2
  // e.g. 20100000000 -> 0100000000
  if (cleaned.startsWith("20") && cleaned.length === 12) {
    cleaned = cleaned.slice(2);
  }

  // Ensure starts with 0
  if (!cleaned.startsWith("0")) {
    cleaned = "0" + cleaned;
  }

  return cleaned;
};

// ─── Helper: Validate password strength ─────────────────────────────────────
const validatePassword = (password) => {
  const errors = [];
  if (password.length < 8) {
    errors.push("Password must be at least 8 characters");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }
  return errors;
};

// ─── Helper: Generate 6-digit OTP ───────────────────────────────────────────
const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

// ─── Helper: Safe user object (never returns password) ──────────────────────
const safeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  avatar: user.avatar,
  role: user.role,
});

// ─── REGISTER ───────────────────────────────────────────────────────────────
const register = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email is already registered",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      phone: phone ? normalizePhone(phone) : undefined,
    });

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          avatar: user.avatar,
          role: user.role,
          createdAt: user.createdAt,
        },
      },
    });
  } catch (error) {
    console.error("Register Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ─── LOGIN ──────────────────────────────────────────────────────────────────
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({ email: normalizedEmail }).select(
      "+password"
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = generateToken(user._id);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user: safeUser(user),
        token,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ─── GET CURRENT USER ───────────────────────────────────────────────────────
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    return res.status(200).json({
      success: true,
      data: {
        user: safeUser(user),
      },
    });
  } catch (error) {
    console.error("GetMe Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ─── FORGOT PASSWORD (via phone) ───────────────────────────────────────────
const forgotPassword = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    const normalizedPhone = normalizePhone(phone);

    if (!normalizedPhone || normalizedPhone.length !== 11) {
      return res.status(400).json({
        success: false,
        message: "Invalid phone number format",
      });
    }

    const user = await User.findOne({ phone: normalizedPhone }).select(
      "+passwordResetOtp +passwordResetOtpExpires"
    );

    if (!user) {
      // Do not reveal whether the phone is registered
      return res.status(200).json({
        success: true,
        message:
          "If an account with that phone number exists, an OTP has been generated",
      });
    }

    const otp = generateOTP();
    const hashedOtp = await bcrypt.hash(otp, 10);

    user.passwordResetOtp = hashedOtp;
    user.passwordResetOtpExpires = Date.now() + 5 * 60 * 1000; // 5 minutes
    await user.save({ validateModifiedOnly: true });

    const responsePayload = {
      success: true,
      message: "OTP generated successfully",
    };

    // Only expose OTP in development for testing
    if (process.env.NODE_ENV === "development") {
      responsePayload.data = {
        otp,
        expiresIn: 300,
      };
    }

    return res.status(200).json(responsePayload);
  } catch (error) {
    console.error("ForgotPassword Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ─── VERIFY RESET OTP ───────────────────────────────────────────────────────
const verifyResetOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({
        success: false,
        message: "Phone number and OTP are required",
      });
    }

    const normalizedPhone = normalizePhone(phone);

    const user = await User.findOne({ phone: normalizedPhone }).select(
      "+passwordResetOtp +passwordResetOtpExpires"
    );

    if (!user || !user.passwordResetOtp || !user.passwordResetOtpExpires) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    // Check expiration
    if (Date.now() > user.passwordResetOtpExpires.getTime()) {
      // Clear expired OTP
      user.passwordResetOtp = undefined;
      user.passwordResetOtpExpires = undefined;
      await user.save({ validateModifiedOnly: true });

      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new one",
      });
    }

    // Compare OTP
    const isOtpValid = await bcrypt.compare(otp, user.passwordResetOtp);

    if (!isOtpValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    // OTP is valid — generate a short-lived reset token
    const resetToken = jwt.sign(
      { id: user._id, purpose: "password-reset" },
      process.env.JWT_SECRET,
      { expiresIn: "10m" }
    );

    // Clear OTP after successful verification (single-use)
    user.passwordResetOtp = undefined;
    user.passwordResetOtpExpires = undefined;
    await user.save({ validateModifiedOnly: true });

    return res.status(200).json({
      success: true,
      message: "OTP verified successfully",
      data: {
        resetToken,
      },
    });
  } catch (error) {
    console.error("VerifyOtp Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ─── RESET PASSWORD ─────────────────────────────────────────────────────────
const resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword, confirmPassword } = req.body;

    if (!resetToken || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Reset token, new password and confirm password are required",
      });
    }

    // Verify the reset token
    let decoded;
    try {
      decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token",
      });
    }

    if (decoded.purpose !== "password-reset") {
      return res.status(400).json({
        success: false,
        message: "Invalid reset token",
      });
    }

    // Validate password match
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match",
      });
    }

    // Validate password strength
    const passwordErrors = validatePassword(newPassword);
    if (passwordErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: passwordErrors.join(". "),
      });
    }

    const user = await User.findById(decoded.id).select("+password");

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid reset token",
      });
    }

    // Hash and update password
    user.password = await bcrypt.hash(newPassword, 12);
    await user.save({ validateModifiedOnly: true });

    return res.status(200).json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("ResetPassword Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

module.exports = {
  register,
  login,
  getMe,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
};
