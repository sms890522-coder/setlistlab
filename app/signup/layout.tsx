import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "회원가입 | 콘티연습실",
  description: "콘티와 곡 보관함을 저장하고, 팀 초대, 팀 채팅, 공지사항과 알림 기능을 함께 사용할 수 있습니다.",
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
