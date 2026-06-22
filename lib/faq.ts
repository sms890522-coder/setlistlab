export type FaqItem = {
  question: string;
  answer: string;
};

export const faqItems: FaqItem[] = [
  {
    question: "콘티연습실은 어떤 서비스인가요?",
    answer:
      "찬양팀이 콘티를 만들고, 악보 이미지와 유튜브 연습 링크, 팀 채팅, 공지사항, 캘린더, PDF 공유까지 한 곳에서 관리할 수 있는 예배 준비 도구입니다.",
  },
  {
    question: "앱 설치가 필요한가요?",
    answer: "별도 앱 설치 없이 웹에서 사용할 수 있으며, PC와 휴대폰 모두 지원합니다.",
  },
  {
    question: "악보를 직접 제공하나요?",
    answer:
      "콘티연습실은 악보를 직접 제공하지 않습니다. 사용자가 보유한 악보 이미지를 등록하거나 검색 도우미를 통해 필요한 자료를 직접 찾을 수 있도록 돕습니다.",
  },
  {
    question: "팀원들과 함께 사용할 수 있나요?",
    answer: "팀 초대, 팀 채팅, 1:1 대화, 공지사항, 캘린더와 알림 기능을 통해 찬양팀이 함께 사용할 수 있습니다.",
  },
  {
    question: "튜너와 메트로놈도 사용할 수 있나요?",
    answer: "브라우저에서 바로 사용할 수 있는 튜너와 메트로놈을 제공해 예배 전 연습에 활용할 수 있습니다.",
  },
];

export const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqItems.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
};
