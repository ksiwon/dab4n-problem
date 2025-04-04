import React, { useState, useEffect, useRef, JSX } from 'react';
import { CallMathGPT } from "./api/mathgpt";
import UserInput from './components/UserInput';
import { db } from './fireBase';
import { doc, addDoc, setDoc, collection } from "firebase/firestore";
import './App.css';
// 채팅 메시지 타입 정의
interface ChatMessage {
  user: string;
  message: string;
}

// Window 인터페이스에 katex 속성 추가
declare global {
  interface Window {
    katex: any;
    renderMathInElement: any;
  }
}

const App: React.FC = () => {
  const [chatlog, setChatlog] = useState<ChatMessage[]>([]);
  const [user_name, setUserName] = useState<string>("");
  const [user_name_flag, setUserNameFlag] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // 자동 스크롤 기능
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatlog]);

  // useEffect 코드 수정
  useEffect(() => {
    // 채팅이 업데이트되면 KaTeX 렌더링 실행
    if (window.renderMathInElement && chatContainerRef.current) {
      setTimeout(() => {
        // 모든 수학 콘텐츠 렌더링
        const mathElements = chatContainerRef.current?.querySelectorAll('.math-content') || [];
        mathElements.forEach(element => {
          window.renderMathInElement(element, {
            delimiters: [
              {left: "$$", right: "$$", display: true},
              {left: "$", right: "$", display: false}
            ],
            throwOnError: false,
            strict: false,
            trust: true
          });
        });
      }, 200);
    }
  }, [chatlog]);

  const handleChat = (message1: string, message2: string) => {
    const chat: ChatMessage[] = [
      { user: user_name, message: message1 },
      { user: "Math Tutor", message: message2 },
    ];
    setChatlog(prevChatlog => [...prevChatlog, ...chat]);
  };
  
  const handleClickAPICall = async (userInput: string) => {
    try {
      setLoading(true);
      
      // 안전 검사: 필요한 매개변수 확인
      if (!user_name) {
        throw new Error("사용자 이름이 없습니다");
      }
      
      const message = await CallMathGPT({ 
        prompt: userInput, 
        pastchatlog: chatlog, 
        user_name: user_name 
      });
      
      if (chatlog.length === 0) {
        handleChat("", message);
      } else {
        handleChat(userInput, message);
        try {
          await addDoc(collection(db, user_name + "Math"), {
            chat_number: (chatlog.length) / 2,
            timestamp: new Date(),
            input: userInput,
            output: message,
          });
        } catch (error) {
          console.error("채팅 저장 오류:", error);
        }
      }
    } catch (error) {
      console.error("API 호출 오류:", error);
      handleChat(userInput, "죄송합니다, 문제 해결 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally { 
      setLoading(false);
    }
  };

  const handleSubmit = (userInput: string) => {
    console.log("user input", userInput);
    handleClickAPICall(userInput);
  };

  const handleUserNameInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUserName(e.target.value);
  }

  const handleUserName = async () => {
    if (user_name === "") {
      alert("이름을 입력해주세요");
    } else {
      setUserNameFlag(true);
      try {
        await setDoc(doc(db, user_name + "Math", "Info"), {
          name: user_name,
          expertise: "",
          preferences: "",
        });
        handleClickAPICall("안녕하세요");
      } catch (error) {
        console.error("사용자 정보 저장 오류:", error);
        alert("사용자 정보 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
        setUserNameFlag(false);
      }
    }
  };

  // SVG 코드 추출 및 렌더링 함수
  const renderMessageContent = (message: string) => {
    if (!message) return null;
    
    // SVG 코드 추출
    const svgRegex = /<svg[\s\S]*?<\/svg>/g;
    const svgMatches = message.match(svgRegex);
    
    if (!svgMatches) {
      // SVG가 없는 경우 LaTeX 수식 처리
      return renderMathContent(message);
    }
    
    // SVG와 텍스트 분리
    const parts = message.split(svgRegex);
    const result: JSX.Element[] = [];
    
    // 텍스트와 SVG 번갈아가며 추가
    parts.forEach((part, index) => {
      // 텍스트 부분 추가 (LaTeX 처리)
      if (part) {
        result.push(
          <div key={`text-${index}`}>
            {renderMathContent(part)}
          </div>
        );
      }
      
      // SVG 부분 추가
      if (svgMatches[index]) {
        result.push(
          <div 
            key={`svg-${index}`} 
            dangerouslySetInnerHTML={{ __html: svgMatches[index] }}
            className="svg-container"
          />
        );
      }
    });
    
    return result;
  };
  
  // LaTeX 수식 처리 함수
  const renderMathContent = (text: string) => {
    // 마크다운 특수문자 처리
    const processMarkdown = (str: string) => {
      // # 기호로 시작하는 제목을 <h> 태그로 변환
      str = str.replace(/^###\s+(.*?)$/gm, '<h3>$1</h3>');
      str = str.replace(/^##\s+(.*?)$/gm, '<h2>$1</h2>');
      str = str.replace(/^#\s+(.*?)$/gm, '<h1>$1</h1>');
      
      // 볼드체 처리
      str = str.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      
      // 이탤릭체 처리
      str = str.replace(/\*(.*?)\*/g, '<em>$1</em>');
      
      return str;
    };

    // 코드 블록 보존
    const codeBlocks: string[] = [];
    let processedText = text.replace(/```([\s\S]*?)```/g, (match) => {
      const index = codeBlocks.length;
      codeBlocks.push(match);
      return `__CODE_BLOCK_${index}__`;
    });

    // 마크다운 처리
    processedText = processMarkdown(processedText);
    
    // LaTeX 구문 보존 및 처리
    const latexBlocks: string[] = [];
    
    // 블록 수식 처리 ($$...$$)
    processedText = processedText.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
      const index = latexBlocks.length;
      latexBlocks.push(`<div class="katex-block">$$${formula}$$</div>`);
      return `__LATEX_BLOCK_${index}__`;
    });
    
    // 인라인 수식 처리 ($...$)
    processedText = processedText.replace(/\$(.*?)\$/g, (match, formula) => {
      const index = latexBlocks.length;
      latexBlocks.push(`<span class="katex-inline">$${formula}$</span>`);
      return `__LATEX_INLINE_${index}__`;
    });
    
    // LaTeX 명령어 처리(\[, \], \(, \))
    processedText = processedText.replace(/\\\[([\s\S]*?)\\\]/g, (match, formula) => {
      const index = latexBlocks.length;
      latexBlocks.push(`<div class="katex-block">$$${formula}$$</div>`);
      return `__LATEX_BLOCK_${index}__`;
    });
    
    processedText = processedText.replace(/\\\((.*?)\\\)/g, (match, formula) => {
      const index = latexBlocks.length;
      latexBlocks.push(`<span class="katex-inline">$${formula}$</span>`);
      return `__LATEX_INLINE_${index}__`;
    });
    
    // 줄바꿈 처리
    processedText = processedText.replace(/\n/g, '<br />');
    
    // 코드 블록 복원
    codeBlocks.forEach((block, index) => {
      const code = block.replace(/```([\s\S]*?)```/, '$1').trim();
      processedText = processedText.replace(
        `__CODE_BLOCK_${index}__`,
        `<pre class="code-block"><code>${code}</code></pre>`
      );
    });
    
    // LaTeX 블록 복원
    latexBlocks.forEach((block, index) => {
      if (block.includes('katex-block')) {
        processedText = processedText.replace(`__LATEX_BLOCK_${index}__`, block);
      } else {
        processedText = processedText.replace(`__LATEX_INLINE_${index}__`, block);
      }
    });
    
    return <div className="math-content" dangerouslySetInnerHTML={{ __html: processedText }} />;
  };

  return (
    <div className="app-wrapper">
      {user_name_flag ? (
        <div className="app-container">
          <div className="chat-container" ref={chatContainerRef}>
            {chatlog.map((chat, index) => {
              if (chat.message === "") {
                return null;
              }
              return (
                <div 
                  key={index} 
                  className={`message-container ${chat.user === user_name ? 'user-message' : 'tutor-message'}`}
                >
                  <div className="user-name">{chat.user}</div>
                  <div className={`message-bubble ${chat.user === user_name ? 'user-bubble' : 'tutor-bubble'}`}>
                    {renderMessageContent(chat.message)}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="input-container">
            <UserInput isLoading={loading} onSubmit={handleSubmit} />
          </div>
        </div>
      ) : (
        <div className="login-container">
          <h1 className="title">수학 문제 솔버</h1>
          <p className="subtitle">복잡한 수학 문제를 단계별로 해결해드립니다.</p>
          <div className="input-group">
            <label className="label">이름을 입력해주세요</label>
            <input 
              type="text" 
              value={user_name} 
              onChange={handleUserNameInput}
              placeholder="이름 또는 닉네임"
              className="name-input"
            />
            <button className="button" onClick={handleUserName}>시작하기</button>
          </div>
          <div className="features">
            <div className="feature">✓ 단계별 문제 해결</div>
            <div className="feature">✓ LaTeX 수식 지원</div>
            <div className="feature">✓ 그래프 및 시각화</div>
            <div className="feature">✓ 맞춤형 설명</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;