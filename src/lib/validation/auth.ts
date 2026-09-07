import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("メールアドレスの形式が正しくありません。"),
  password: z.string().min(1, "パスワードを入力してください。").max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const signupSchema = z.object({
  displayName: z.string().trim().min(1, "お名前を入力してください。").max(80),
  email: z.email("メールアドレスの形式が正しくありません。"),
  password: z
    .string()
    .min(8, "パスワードは8文字以上で入力してください。")
    .max(128, "パスワードは128文字以内で入力してください。"),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const onboardingSchema = z.object({
  organizationName: z
    .string()
    .trim()
    .min(1, "組織名を入力してください。")
    .max(120, "組織名は120文字以内で入力してください。"),
  companyName: z.string().trim().max(120).default(""),
});
export type OnboardingInput = z.infer<typeof onboardingSchema>;
export type OnboardingFormValues = z.input<typeof onboardingSchema>;
