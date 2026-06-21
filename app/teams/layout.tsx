import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "내 팀 관리 | 콘티연습실",
  description: "팀원을 초대하고 승인하며, 팀 채팅과 공지사항, 알림으로 찬양팀 소통을 관리할 수 있습니다.",
};

export default function TeamsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
