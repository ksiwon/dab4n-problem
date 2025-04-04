import React, { useState, KeyboardEvent } from 'react';
import './UserInput.css';

interface UserInputProps {
  isLoading: boolean;
  onSubmit: (input: string) => void;
}

const UserInput: React.FC<UserInputProps> = ({ isLoading, onSubmit }) => {
  const [input, setInput] = useState<string>('');

  const handleSubmit = () => {
    if (input.trim() === '' || isLoading) return;
    onSubmit(input);
    setInput('');
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="user-input-container">
      <textarea
        className="input-textarea"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder="수학 문제를 입력하세요..."
        disabled={isLoading}
        rows={3}
      />
      <button
        className={`submit-button ${isLoading ? 'loading' : ''}`}
        onClick={handleSubmit}
        disabled={isLoading || input.trim() === ''}
      >
        {isLoading ? '처리 중...' : '전송'}
      </button>
    </div>
  );
};

export default UserInput;