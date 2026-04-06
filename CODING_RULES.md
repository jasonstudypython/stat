# Coding Rules

## Korean Text Safety

- 한글 관련 수정은 반드시 `apply_patch`로만 수행한다.
- `shell_command`는 읽기, 검색, 빌드, 검사용으로만 사용한다.
- PowerShell here-string, `node -e`, 문자열 치환으로 한글을 직접 파일에 쓰지 않는다.
- 한글이 들어가는 파일은 UTF-8을 유지한다.
- 모든 수정 후 `npm run check:korean`을 실행해 `??`, `�`, 깨짐 패턴이 없는지 확인한다.
- 배포 전에는 `npm run check:korean` 후 `npm run build`를 순서대로 실행한다.

## Recommended Workflow

1. 파일을 읽고 수정 위치를 확인한다.
2. 코드와 텍스트 수정은 `apply_patch`로 반영한다.
3. `npm run check:korean`으로 깨짐 여부를 검사한다.
4. `npm run build`로 최종 확인한다.
