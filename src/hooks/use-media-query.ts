'use client';

import { useState, useEffect } from 'react';

/**
 * メディアクエリの状態を監視するカスタムフック
 * @param query メディアクエリ文字列 (例: "(max-width: 768px)")
 * @returns メディアクエリがマッチするかどうかのboolean値
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    // サーバーサイドレンダリング時はfalseを返す
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia(query);

    // 初期値を設定
    setMatches(mediaQuery.matches);

    // メディアクエリの変更を監視
    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // リスナーを登録
    mediaQuery.addEventListener('change', handleChange);

    // クリーンアップ
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [query]);

  return matches;
}

/**
 * モバイルデバイスかどうかを判定するフック
 * @returns モバイルデバイスの場合true (画面幅768px未満)
 */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 768px)');
}
