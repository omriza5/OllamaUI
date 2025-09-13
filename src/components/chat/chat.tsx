"use client";

import ChatTopbar from "./chat-topbar";
import ChatList from "./chat-list";
import ChatBottombar from "./chat-bottombar";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { BytesOutputParser } from "@langchain/core/output_parsers";
import { Attachment, ChatRequestOptions, generateId } from "ai";
import { Message, useChat } from "ai/react";
import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import useChatStore from "@/app/hooks/useChatStore";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { set } from "lodash";

export interface ChatProps {
  id: string;
  initialMessages: Message[] | [];
  isMobile?: boolean;
}

export default function Chat({ initialMessages, id, isMobile }: ChatProps) {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    stop,
    setMessages,
    setInput,
    reload,
  } = useChat({
    id,
    initialMessages,
    onResponse: (response) => {
      if (response) {
        setLoadingSubmit(false);
      }
    },
    onFinish: (message) => {
      const savedMessages = getMessagesById(id);
      saveMessages(id, [...savedMessages, message]);
      setLoadingSubmit(false);
      router.replace(`/c/${id}`);
    },
    onError: (error) => {
      setLoadingSubmit(false);
      router.replace("/");
      console.error(error.message);
      console.error(error.cause);
    },
  });
  const [loadingSubmit, setLoadingSubmit] = React.useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const base64Images = useChatStore((state) => state.base64Images);
  const setBase64Images = useChatStore((state) => state.setBase64Images);
  const saveMessages = useChatStore((state) => state.saveMessages);
  const getMessagesById = useChatStore((state) => state.getMessagesById);
  const currentImageName = useChatStore((state) => state.currentImageName);
  const [predictionUid, setPredictionUid] = useState<string | null>(null);
  const router = useRouter();
  const { result: predictionResult, loading: pollingLoading } =
    usePredictionPolling(predictionUid);

  console.log("PREDICTION RESULT", predictionResult);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    window.history.replaceState({}, "", `/c/${id}`);

    const userMessage: Message = {
      id: generateId(),
      role: "user",
      content: input,
    };

    setLoadingSubmit(true);

    const attachments: Attachment[] = base64Images
      ? base64Images.map((image) => ({
          contentType: "image/base64",
          url: image,
        }))
      : [];

    const predictionUid = uuidv4();
    const requestOptions: ChatRequestOptions = {
      ...(base64Images && {
        data: {
          images: base64Images,
          chatId: id,
          imageName: currentImageName,
          predictionUid,
        },
        experimental_attachments: attachments,
      }),
    };
    setPredictionUid(predictionUid);
    handleSubmit(e, requestOptions);
    saveMessages(id, [...messages, userMessage]);
    setBase64Images(null);
  };

  const removeLatestMessage = () => {
    const updatedMessages = messages.slice(0, -1);
    setMessages(updatedMessages);
    saveMessages(id, updatedMessages);
    return updatedMessages;
  };

  const handleStop = () => {
    stop();
    saveMessages(id, [...messages]);
    setLoadingSubmit(false);
  };

  return (
    <div className="flex flex-col w-full max-w-3xl h-full">
      <ChatTopbar
        isLoading={isLoading}
        chatId={id}
        messages={messages}
        setMessages={setMessages}
      />

      {messages.length === 0 ? (
        <div className="flex flex-col h-full w-full items-center gap-4 justify-center">
          <Image
            src="/ollama.png"
            alt="AI"
            width={40}
            height={40}
            className="h-16 w-14 object-contain dark:invert"
          />
          <p className="text-center text-base text-muted-foreground">
            How can I help you today?
          </p>
          <ChatBottombar
            input={input}
            handleInputChange={handleInputChange}
            handleSubmit={onSubmit}
            isLoading={isLoading}
            stop={handleStop}
            setInput={setInput}
          />
        </div>
      ) : (
        <>
          <ChatList
            messages={messages}
            isLoading={isLoading}
            loadingSubmit={loadingSubmit}
            reload={async () => {
              removeLatestMessage();

              setLoadingSubmit(true);
              return reload();
            }}
          />
          <ChatBottombar
            input={input}
            handleInputChange={handleInputChange}
            handleSubmit={onSubmit}
            isLoading={isLoading}
            stop={handleStop}
            setInput={setInput}
          />
        </>
      )}
    </div>
  );
}

export function usePredictionPolling(
  predictionUid: string | null,
  interval = 2000
) {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const timer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!predictionUid) return;

    setLoading(true);

    const poll = async () => {
      try {
        // Call your API route that proxies to yoloService
        const res = await fetch(`/api/prediction/${predictionUid}`);
        const data = await res.json();
        setResult(data);
        // Stop polling if prediction is complete (adjust condition as needed)
        if (data.uid) {
          toast.success("Prediction completed successfully!");

          // Format the data object for readable display with bold keys
          const formatData = (obj: any, indent = 0) => {
            const spaces = "  ".repeat(indent);
            let result = "";

            for (const [key, value] of Object.entries(obj)) {
              if (Array.isArray(value)) {
                result += `${spaces}**${key}**:\n`;
                value.forEach((item, index) => {
                  result += `${spaces}  [${index}]:\n`;
                  if (typeof item === "object") {
                    result += formatData(item, indent + 2);
                  } else {
                    result += `${spaces}    ${item}\n`;
                  }
                });
              } else if (typeof value === "object" && value !== null) {
                result += `${spaces}**${key}**:\n`;
                result += formatData(value, indent + 1);
              } else {
                result += `${spaces}**${key}**: ${value}\n`;
              }
            }
            return result;
          };

          alert(formatData(data));
          setLoading(false);
          return;
        }
        timer.current = setTimeout(poll, interval);
      } catch (err) {
        setLoading(false);
      }
    };

    poll();

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [predictionUid, interval]);

  return { result, loading };
}
