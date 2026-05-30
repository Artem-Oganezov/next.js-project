// Импортируем клиентский компонент с игрой на Canvas
import DinoGame from "@/components/DinoGame";

// Главная страница приложения (App Router: файл app/page.tsx = маршрут "/")
export default function Home() {
  return (
    // min-h-screen — страница на всю высоту окна; flex — центрируем игру
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#fafafa]">
      {/* Компонент со всей логикой игры, циклом requestAnimationFrame и физикой */}
      <DinoGame />
    </main>
  );
}
