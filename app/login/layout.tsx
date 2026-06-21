import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "로그인 | 콘티연습실",
  description: "콘티, 곡 보관함, 팀 정보, 채팅과 알림을 계정에 저장하고 PC와 휴대폰에서 이어서 사용할 수 있습니다.",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
