import { describe, it, expect } from "vitest";

import {
    PASSWORD_MIN,
    describePasswordError,
    isEmail,
    readLinkError,
    resetRedirectUrl,
    validateNewPassword,
} from "../frontend/auth/password-rules.js";

describe("Aturan password (ganti & lupa password)", () => {
    it("password baru yang aman lolos", () => {
        expect(validateNewPassword("Kantoong2026", "Kantoong2026", "lama12345")).toBe("");
        expect(validateNewPassword("abcd1234", "abcd1234")).toBe("");
    });

    it("terlalu pendek, tanpa angka / huruf, atau berspasi di tepi ditolak", () => {
        expect(validateNewPassword("ab12", "ab12")).toContain(String(PASSWORD_MIN));
        expect(validateNewPassword("abcdefgh", "abcdefgh")).toMatch(/huruf dan angka/);
        expect(validateNewPassword("12345678", "12345678")).toMatch(/huruf dan angka/);
        expect(validateNewPassword(" abcd1234", " abcd1234")).toMatch(/spasi/);
    });

    it("harus berbeda dari password lama & ulangan harus sama", () => {
        expect(validateNewPassword("abcd1234", "abcd1234", "abcd1234")).toMatch(/berbeda/);
        expect(validateNewPassword("abcd1234", "abcd12345")).toMatch(/belum sama/);
    });

    it("alamat halaman reset dibuat dari alamat web", () => {
        expect(resetRedirectUrl("http://127.0.0.1:5173")).toBe("http://127.0.0.1:5173/auth/reset-password.html");
        expect(resetRedirectUrl("https://kantoong.id/")).toBe("https://kantoong.id/auth/reset-password.html");
    });

    it("email dicek sederhana", () => {
        expect(isEmail("owner@kantoong.id")).toBe(true);
        expect(isEmail("bukan email")).toBe(false);
        expect(isEmail("")).toBe(false);
    });

    it("pesan Supabase diterjemahkan", () => {
        expect(describePasswordError({ message: "Invalid login credentials" })).toBe("Password lama salah.");
        expect(describePasswordError({ code: "same_password", message: "x" })).toMatch(/berbeda/);
        expect(describePasswordError({ message: "For security purposes, you can only request this after 42 seconds." })).toMatch(/1 menit/);
        expect(describePasswordError({ message: "Auth session missing!" })).toMatch(/Lupa password/);
    });

    it("link email kedaluwarsa dikenali dari alamat halaman", () => {
        expect(readLinkError("#error=access_denied&error_code=otp_expired&error_description=x")).toMatch(/kedaluwarsa/);
        expect(readLinkError("", "?error=server_error")).toMatch(/tidak berlaku/);
        expect(readLinkError("#access_token=abc&type=recovery")).toBe("");
    });
});
