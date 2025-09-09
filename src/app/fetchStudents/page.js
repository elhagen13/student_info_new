"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import {
  Box,
  Button,
  Heading,
  Progress,
  List,
  ListItem,
  Text,
  useToast,
  VStack,
  Code,
  Spinner,
  Center,
} from "@chakra-ui/react";

// Separate component that uses useSearchParams
function FetchingContent() {
  const [messages, setMessages] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const searchParams = useSearchParams();
  const router = useRouter();

  const toast = useToast();

  const [status, setStatus] = useState("Starting process...");
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const studentsParam = searchParams.get("students");
    const classesParam = searchParams.get("classes");
    const usernameParam = searchParams.get("username");
    const passwordParam = searchParams.get("password");

    if (!studentsParam || !classesParam || !usernameParam || !passwordParam) {
      toast({
        title: "Error",
        description:
          "Missing required parameters. Please go back and try again.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      router.push("/");
      return;
    }

    const parsedStudents = JSON.parse(studentsParam);
    const parsedClasses = JSON.parse(classesParam);

    setStudents(parsedStudents);
    setClasses(parsedClasses);
    setUsername(usernameParam);
    setPassword(passwordParam);

    setStatus(
      "Data loaded successfully. Ready to fetch student information..."
    );
  }, [searchParams, router, toast]);

  const startStream = async () => {
    setMessages([]);
    setProgress(0);
    setIsRunning(true);

    const response = await fetch("/api/scrapeStudents", {
      method: "POST",
      body: JSON.stringify({
        user: username,
        pass: password,
        studentList: students,
        classList: classes,
      }),
    });

    if (!response.body) {
      console.error("No response body from stream");
      setIsRunning(false);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const events = chunk.split("\n\n").filter(Boolean);

        for (const event of events) {
          if (event.startsWith("data:")) {
            try {
              const data = JSON.parse(event.replace("data: ", ""));
              setMessages((prev) => [...prev, data]);

              if (data.progress !== undefined) {
                setProgress(data.progress);
              }
            } catch (err) {
              console.error("Failed to parse SSE event:", err);
            }
          }
        }
      }
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Box maxW="2xl" mx="auto" p={6}>
      <Heading as="h1" size="xl" mb={6}>
        Puppeteer Stream
      </Heading>

      <Button
        colorScheme="blue"
        onClick={startStream}
        isDisabled={isRunning}
        mb={6}
      >
        {isRunning ? "Running..." : "Start Stream"}
      </Button>

      <Progress value={progress} size="sm" colorScheme="green" mb={6} />

      <VStack align="stretch" spacing={3}>
        <Text fontWeight="semibold">{status}</Text>

        <List spacing={3}>
          {messages.map((msg, i) => (
            <ListItem
              key={i}
              p={3}
              borderWidth="1px"
              borderRadius="md"
              bg="gray.50"
            >
              <Text>
                <Text as="span" fontWeight="bold">
                  {msg.progress ?? 0}%
                </Text>{" "}
                — {msg.status}
              </Text>
              {msg.error && (
                <Text color="red.500" mt={1}>
                  Error: {msg.error}
                </Text>
              )}
              {msg.finalResults && (
                <Code
                  display="block"
                  whiteSpace="pre"
                  fontSize="sm"
                  p={2}
                  mt={2}
                  borderRadius="md"
                  bg="gray.100"
                >
                  {JSON.stringify(msg.finalResults, null, 2)}
                </Code>
              )}
            </ListItem>
          ))}
        </List>
      </VStack>
    </Box>
  );
}

// Loading fallback component
function LoadingFallback() {
  return (
    <Center h="200px">
      <VStack>
        <Spinner size="xl" />
        <Text>Loading...</Text>
      </VStack>
    </Center>
  );
}

// Main component that wraps the content in Suspense
export default function FetchingPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <FetchingContent />
    </Suspense>
  );
}