// 이미지 이외의 대화/인증 데이터에는 관여하지 않습니다.
export function artworkSource(
  base: string,
  scope: string,
  id: string,
  preview: boolean,
  headers: Record<string, string>,
) {
  const variant = preview ? "thumbnail" : "image";
  return {
    uri: `${base}/diaries/${id}/${variant}`,
    headers,
    // 인증 토큰을 키에 노출하지 않고 로그인 화면 진입마다 별도 범위를 사용합니다.
    cacheKey: `${base}/${scope}/${id}/${variant}/v1`,
  };
}

export function imageIsNearViewport(
  top: number,
  height: number,
  viewportTop: number,
  viewportHeight: number,
) {
  return (
    height > 0 &&
    viewportHeight > 0 &&
    top + height > viewportTop - 120 &&
    top < viewportTop + viewportHeight + 120
  );
}
