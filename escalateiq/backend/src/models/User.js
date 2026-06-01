import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 50,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['user', 'moderator', 'admin'],
      default: 'user',
    },
    reputation: {
      type: Number,
      default: 0,
    },
    isBanned: {
      type: Boolean,
      default: false,
    },
    banExpiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

// Never expose passwordHash in JSON responses
userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.passwordHash;
    return ret;
  },
});

userSchema.methods.verifyPassword = async function (plainPassword) {
  return bcrypt.compare(plainPassword, this.passwordHash);
};

userSchema.statics.hashPassword = async function (plainPassword) {
  return bcrypt.hash(plainPassword, 12);
};

// Check if user is currently banned
userSchema.methods.isCurrentlyBanned = function () {
  if (this.isBanned) return true;
  if (this.banExpiresAt && this.banExpiresAt > new Date()) return true;
  return false;
};

const User = mongoose.model('User', userSchema);
export default User;
