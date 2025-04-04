import { db } from "../fireBase";
import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore";

// 채팅 메시지 타입 정의
interface ChatMessage {
  user: string;
  message: string;
}

// 함수 파라미터 타입 정의
interface CallMathGPTParams {
  prompt: string;
  pastchatlog: ChatMessage[];
  user_name: string;
}

// 사용자 데이터 타입 정의
interface UserData {
  name: string;
  expertise: string;  // 사용자의 수학 지식 수준
  preferences: string; // 설명 방식 선호도
}

export const CallMathGPT = async ({
  prompt,
  pastchatlog,
  user_name,
}: CallMathGPTParams): Promise<string> => {
  // 먼저 사용자 문서 참조 생성
  const docRef = doc(db, user_name + "Math", "Info");
  
  // 기본 사용자 데이터 설정
  const user_data: UserData = {
    name: user_name,
    expertise: "",
    preferences: ""
  };

  try {
    // 사용자 데이터 가져오기 시도
    const docSnap = await getDoc(docRef);
    
    // 사용자 문서가 존재하면 데이터 업데이트
    if (docSnap.exists()) {
      const userData = docSnap.data() as UserData;
      if (userData.expertise) {
        user_data.expertise = userData.expertise;
      }
      if (userData.preferences) {
        user_data.preferences = userData.preferences;
      }
    } else {
      // 사용자 문서가 없으면 생성
      await setDoc(docRef, user_data);
    }
  } catch (error) {
    console.error("사용자 데이터 가져오기 오류:", error);
    // 오류가 있어도 계속 진행 (기본 데이터 사용)
  }

  const input = prompt;

  // 이전 대화 문자열로 변환
  const chatlog = pastchatlog && pastchatlog.length > 0
    ? "이전대화: \n" + pastchatlog.map((obj) => JSON.stringify(obj)).join("\n")
    : "";

  // 수학 문제 분석 및 형식화 프롬프트
  const math_parser_prompt = `입력된 텍스트에서 수학 문제를 인식하고 분석해 주세요. 다음 단계에 따라 문제를 정확하게 처리해 주세요:

1. 문제 유형 식별: 대수, 미적분, 기하, 통계, 확률 등 문제의 유형을 파악하세요.
2. 문제의 형식적 표현: KaTeX 문법을 정확히 사용하여 수식을 표현하세요.
   - 인라인 수식은 단일 달러 기호로 감싸세요: $수식$
   - 디스플레이 수식은 이중 달러 기호로 감싸세요: $$수식$$
   - 예시: $x^2 + y^2 = 2$와 같이 정확한 KaTeX 구문 사용
3. 주요 수학 개념 추출: 문제를 해결하기 위해 필요한 핵심 개념을 정리하세요.
4. 해결에 필요한 핵심 정보 정리: 변수, 조건, 제약 사항 등을 명확히 하세요.

입력 텍스트에 수학 문제가 포함되어 있지 않다면, 수학적 개념이나 관련 있는 수식에 대한 설명을 정확한 KaTeX 구문으로 제공해 주세요.`;

  // 단계별 해결 프롬프트
  const step_by_step_solver = `다음 단계에 따라 체계적으로 문제를 해결해 주세요:

1. 문제 재정립: KaTeX 문법을 사용하여 문제를 명확하고 정확하게 재정립하세요.
2. 정답 제시: 문제의 최종 답을 먼저 제시하세요. 가능한 간결하고 명확하게 제시하되, 필요한 경우 KaTeX 수식을 활용하세요.
3. 접근 방법 설명: 이 문제를 해결하기 위해 선택한 수학적 접근 방법이나 전략을 설명하세요.
4. 단계별 해설: 
   - 해결 과정을 명확한 단계로 구분하세요.
   - 각 단계마다 사용된 수학적 원리나 공식을 KaTeX 수식과 함께 자세히 설명하세요.
   - 복잡한 단계는 더 작은 부분으로 나누어 설명하세요.
5. 수치적 계산: 계산 과정을 KaTeX 수식으로 보여주고, 중간 결과도 표시하세요.
6. 확인 및 검증: 가능한 경우, 다른 방법으로 결과를 검증하거나 답안의 타당성을 확인하세요.

모든 수학 표현은 반드시 KaTeX 문법을 사용하고, 오류 없이 정확하게 작성해야 합니다.`;

  // 시각화 지원 프롬프트
  const visualization_prompt = `수학 문제 이해 및 해결 과정을 돕기 위해 필요하다고 판단되는 경우, 다음 기준에 따라 적절한 시각화를 SVG 코드로 제공해 주세요:

1. 문제 이해를 위한 시각화: 
   - 문제의 기하학적 표현이 필요하거나 시각적 이해가 도움이 될 때만 제공
   - 예: 좌표평면 상의 방정식, 기하학적 문제, 벡터 연산 등

2. 해결 과정을 위한 시각화:
   - 풀이 과정에서 시각적 접근이 도움이 될 때 제공
   - 예: 적분 영역 표시, 확률 분포 그래프, 최적화 문제의 극값 등

시각화 유형별 가이드라인:
- 함수 그래프: 좌표축과 눈금을 명확히 표시하고, 중요 지점에 좌표값 표시
- 기하학적 다이어그램: 각도와 길이 비율을 정확히 유지하고 라벨 추가
- 통계 차트: 축과 범례를 명확히 표시
- 확률 트리: 각 분기에 확률값 명확히 표시
- 벡터 다이어그램: 방향과 크기를 정확히 표현

매우 중요: 모든 수학적 관계는 정확하게 표현되어야 합니다. 예를 들어, y=1 직선은 정확히 y=1 위치에 그려져야 합니다. 좌표점과 교차점도 정확한 위치에 표시하세요. 시각화는 문제 이해에 실제로 도움이 될 때만 생성하세요.`;

  // 답변 형식 프롬프트
  const format_prompt = `다음 형식으로 명확하게 답변을 구성해 주세요:

### 문제 재정립:
(KaTeX 문법으로 정확하게 문제를 재정의)

### 정답:
(간결하고 명확하게 최종 답안 먼저 제시)

### 접근 방법:
(문제 해결을 위한 전략 설명)

### 단계별 해결:
1. (첫 번째 단계 설명과 KaTeX 수식)
2. (두 번째 단계 설명과 KaTeX 수식)
...

### 확인 및 검증:
(필요한 경우 다른 방법으로 검증)

문제의 특성에 따라 시각화가 필요한 경우에만 시각화를 포함하고, 모든 수학 수식은 KaTeX 문법을 정확히 사용하세요.`;

  // 사용자 수준 맞춤 설명 프롬프트
  const adaptive_explanation = `사용자의 수학 지식 수준에 맞춰 설명을 조정해 주세요:

1. 초급: 
   - 기본 개념부터 상세히 설명하고, 복잡한 수학적 용어는 간단한 말로 풀어서 설명
   - 각 단계를 매우 자세히 설명하고 중간 과정을 모두 보여줌
   - 직관적인 이해를 돕는 설명 추가

2. 중급: 
   - 관련 개념에 대한 간략한 리뷰와 함께 해결 과정 설명
   - 일부 기본 단계는 생략 가능하지만 중요한 변환이나 계산은 모두 표시
   - 수학적 원리에 대한 설명 포함

3. 고급: 
   - 핵심적인 단계와 수학적 직관에 초점을 맞추어 간결하게 설명
   - 기본적인 변환이나 계산 과정은 생략 가능
   - 더 일반적인 관점이나 대안적 접근법 제시

사용자가 특정 단계나 개념을 이해하지 못하는 것 같다면, 더 기초적인 수준으로 설명을 조정하세요.`;

  // 교육적 확장 프롬프트
  const educational_extension = `답안 제공 후, 학습 효과를 높이기 위해 다음과 같은 추가 정보를 제공하세요:

1. 관련 수학적 개념이나 정리에 대한 간단한 설명
2. 이 문제와 관련된 다른 유형의 문제나 응용 사례
3. 더 복잡한 확장 문제나 도전 과제 제안
4. 학습에 도움이 될 수 있는 자료나 연습 문제 추천

이러한 추가 정보는 문제 해결 과정 이후에 별도 섹션으로 제공하세요.`;

  // API 키 확인
  const apiKey = process.env.REACT_APP_GPT_API_KEY;
  if (!apiKey) {
    return "OpenAI API 키가 설정되지 않았습니다. .env 파일에 REACT_APP_GPT_API_KEY를 추가해주세요.";
  }

  try {
    // 초기 대화인 경우 (안내 메시지)
    if (!pastchatlog || pastchatlog.length === 0) {
      const greeting_messages = [
        { role: "system", content: "당신은 수학 문제 해결을 도와주는 전문 튜터입니다. 정확하고 명확한 설명과 시각화를 통해 사용자가 문제를 이해하고 해결할 수 있도록 도와주세요." },
        { role: "user", content: `${user_data.name}님께 인사하고, 수학 문제 솔루션 서비스를 소개해 주세요. 사용자에게 어떤 유형의 수학 문제든 질문하라고 안내하고, 가능하다면 수학 지식 수준(초급/중급/고급)을 알려달라고 요청하세요.` }
      ];

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: greeting_messages,
          temperature: 0.7,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error("OpenAI API 오류:", errorData);
        return `OpenAI API 오류: ${response.status} ${response.statusText}`;
      }
      
      const responseData = await response.json();
      return responseData.choices[0].message.content;
    }
    // 두 번째 메시지: 사용자의 수학 수준 확인
    else if (pastchatlog.length === 1) {
      // 사용자의 첫 응답에서 수학 수준 정보 추출 시도
      const userResponse = input.toLowerCase();
      let expertiseLevel = "";
      
      if (userResponse.includes("초급") || userResponse.includes("기초") || userResponse.includes("beginner")) {
        expertiseLevel = "초급";
      } else if (userResponse.includes("중급") || userResponse.includes("intermediate")) {
        expertiseLevel = "중급";
      } else if (userResponse.includes("고급") || userResponse.includes("advanced")) {
        expertiseLevel = "고급";
      }
      
      // Firebase에 사용자 정보 업데이트
      if (expertiseLevel) {
        await updateDoc(docRef, {
          expertise: expertiseLevel
        });
        user_data.expertise = expertiseLevel;
      }
      
      // 사용자가 바로 문제를 제시한 경우 해결 시작
      const analysis_messages = [
        { role: "system", content: "당신은 수학 문제 해결을 도와주는 전문 튜터입니다. 정확하고 명확한 설명과 시각화를 통해 사용자가 문제를 이해하고 해결할 수 있도록 도와주세요." },
        { role: "system", content: math_parser_prompt },
        { role: "system", content: step_by_step_solver },
        { role: "system", content: visualization_prompt },
        { role: "system", content: format_prompt },
        { role: "system", content: adaptive_explanation },
        { role: "system", content: educational_extension },
        { role: "user", content: input }
      ];

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: analysis_messages,
          temperature: 0.7,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error("OpenAI API 오류:", errorData);
        return `OpenAI API 오류: ${response.status} ${response.statusText}`;
      }
      
      const responseData = await response.json();
      const message = responseData.choices[0].message.content;
      
      // 문제에 시각화가 필요한지 확인하고 필요한 경우 시각화 생성
      if (message.includes("좌표평면") || message.includes("그래프") || message.includes("기하학적") || 
          message.includes("벡터") || message.includes("통계") || message.includes("확률")) {
        try {
          // 시각화 생성 요청
          const visualization_messages = [
            { role: "system", content: "당신은 수학 문제의 시각화를 생성하는 전문가입니다. SVG 형식으로 명확하고 정확한 시각화를 제공하세요." },
            { role: "system", content: visualization_prompt },
            { role: "user", content: `다음 수학 문제에 대한 시각화를 SVG 코드로 생성해주세요: ${input}` },
            { role: "assistant", content: message },
            { role: "user", content: "이 문제에 대한 시각적 표현을 SVG 코드로 제공해주세요. 모든 수학적 관계를 정확히 표현하고, 특히 y=1 같은 직선은 정확한 위치에 그려주세요." }
          ];

          const viz_response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: "gpt-4o",
              messages: visualization_messages,
              temperature: 0.7,
            }),
          });
          
          if (!viz_response.ok) {
            return message; // 시각화 생성에 실패해도 기본 응답은 반환
          }
          
          const vizData = await viz_response.json();
          const vizMessage = vizData.choices[0].message.content;
          
          // SVG 코드 추출
          const svgMatch = vizMessage.match(/<svg[\s\S]*?<\/svg>/);
          if (svgMatch) {
            // 최종 응답 생성 (텍스트 설명 + 시각화)
            return message + "\n\n### 시각화:\n\n" + svgMatch[0];
          }
        } catch (error) {
          console.error("시각화 생성 중 오류:", error);
        }
      }
      
      return message;
    }
    // 이후 대화: 문제 해결 진행
    else {
      // 이전 대화 컨텍스트와 함께 문제 해결
      const problem_solving_messages = [
        { role: "system", content: "당신은 수학 문제 해결을 도와주는 전문 튜터입니다. 정확하고 명확한 설명과 시각화를 통해 사용자가 문제를 이해하고 해결할 수 있도록 도와주세요." },
        { role: "system", content: math_parser_prompt },
        { role: "system", content: step_by_step_solver },
        { role: "system", content: visualization_prompt },
        { role: "system", content: format_prompt },
        { role: "system", content: adaptive_explanation },
        { role: "system", content: educational_extension },
        { role: "system", content: `사용자의 수학 지식 수준은 ${user_data.expertise || '불명확'}입니다. 설명 방식 선호도: ${user_data.preferences || '기본값'}` },
        { role: "system", content: chatlog },
        { role: "user", content: input }
      ];

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: problem_solving_messages,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("OpenAI API 오류:", errorData);
        return `OpenAI API 오류: ${response.status} ${response.statusText}`;
      }

      const responseData = await response.json();
      const message = responseData.choices[0].message.content;

      // 시각화 생성 및 최종 응답 반환
      if (message.includes("시각화가 필요합니다") || message.includes("그래프") || message.includes("다이어그램") ||
          message.includes("좌표평면") || message.includes("기하학적") || message.includes("벡터")) {
        try {
          // 시각화 생성 요청
          const visualization_messages = [
            { role: "system", content: "당신은 수학 문제의 시각화를 생성하는 전문가입니다. SVG 형식으로 명확하고 정확한 시각화를 제공하세요." },
            { role: "system", content: visualization_prompt },
            { role: "user", content: `다음 수학 문제와 해설에 대한 시각화를 SVG 코드로 생성해주세요: ${input}` },
            { role: "assistant", content: message },
            { role: "user", content: "이 문제에 대한 시각적 표현을 SVG 코드로 제공해주세요. 모든 수학적 관계를 정확히 표현하고, 특히 y=1 같은 직선은 정확한 위치에 그려주세요." }
          ];

          const viz_response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: "gpt-4o",
              messages: visualization_messages,
              temperature: 0.7,
            }),
          });
          
          if (!viz_response.ok) {
            console.error("시각화 생성 오류:", await viz_response.text());
            return message; // 시각화 생성에 실패해도 기본 응답은 반환
          }
          
          const vizData = await viz_response.json();
          const vizMessage = vizData.choices[0].message.content;
          
          // SVG 코드 추출
          const svgMatch = vizMessage.match(/<svg[\s\S]*?<\/svg>/);
          if (svgMatch) {
            // 시각화 코드 검증 - 정확한 y 값 표현 확인
            let svgCode = svgMatch[0];
            
            // 최종 응답 생성 (텍스트 설명 + 시각화)
            return message + "\n\n### 시각화:\n\n" + svgCode;
          }
        } catch (error) {
          console.error("시각화 생성 중 오류:", error);
        }
      }

      return message;
      }
      } catch (error) {
      console.error("MathGPT 호출 중 오류:", error);
      return "수학 문제 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
      }
      };