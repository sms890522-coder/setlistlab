import { PushNotificationManager } from "@/components/PushNotificationManager";
import Link from "next/link";

export default function NotificationSettingsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-violet-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <Link href="/setlists" className="text-sm font-black text-blue-700 transition hover:text-blue-900">
          콘티로 돌아가기
        </Link>

        <section className="rounded-3xl border border-white/80 bg-white/90 p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">Notifications</p>
          <h1 className="mt-2 text-2xl font-black text-slate-950">알림 설정</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            앱 안 알림은 기본으로 사용 중입니다. 휴대폰 푸시 알림을 켜면 사이트를 닫아도 팀 채팅과 새 콘티 소식을 받을 수
            있습니다.
          </p>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-black text-slate-950">앱 안 알림</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            사용 중입니다. 상단 종 아이콘에서 팀 채팅, 콘티, 팀 초대 알림을 확인할 수 있습니다.
          </p>
        </section>

        <PushNotificationManager />

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-black text-slate-950">휴대폰별 안내</p>
          <div className="mt-3 space-y-3 text-sm leading-6 text-slate-600">
            <p>
              <span className="font-black text-slate-800">iPhone:</span> Safari에서 콘티연습실을 연 뒤 공유 버튼을 눌러
              홈 화면에 추가해 주세요. 홈 화면 앱에서 알림을 허용하면 푸시 알림을 받을 수 있습니다.
            </p>
            <p>
              <span className="font-black text-slate-800">Android:</span> Chrome에서 “휴대폰 알림 켜기”를 누르고 알림
              권한을 허용하면 바로 사용할 수 있습니다.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
