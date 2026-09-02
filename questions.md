### Top 30 PyQHeaven Interview Questions

#### 1. Project + Architecture

1. **Explain PyQHeaven end-to-end. What happens from the moment a PDF is collected until a user searches for a question?**

2. **Draw and explain the complete system architecture. Why did you separate the offline processing pipeline from the online application?**

3. **What was the hardest technical problem you faced while building the project, and how did you solve it?**

4. **Why did you choose React + FastAPI + SQLite for this project? What alternatives did you consider?**

---

#### 2. PDF Processing + Data Engineering

5. **How did you process 10K+ PDFs in bulk, and how did you handle both text-based and scanned PDFs?**

6. **Explain your OCR pipeline. How did you determine when OCR was required, and how did you handle OCR failures or poor-quality scans?**

7. **How did you extract individual questions from the raw PDF text when different papers had different formats?**

8. **Why did you use a rules-based parser with an LLM fallback instead of sending every paper/question to an LLM?**

9. **How did you extract and validate metadata such as course code, branch, semester, year, exam type, unit, and marks?**

10. **How did you handle duplicate papers and repeated questions while still preserving legitimate occurrences across different exams?**

---

#### 3. Database + Search

11. **Why did you use SQLite for 200K+ questions instead of PostgreSQL or another database?**

12. **Why did you use SQLite FTS5, and how is it different from a normal `LIKE` query?**

13. **Explain how a keyword search request travels from the React frontend to the database and back to the user.**

14. **Why did you maintain separate question and paper databases, and why is the question database denormalized?**

15. **How did you implement filtering and contextual facet counts without making the search queries unnecessarily expensive?**

---

#### 4. Semantic Search / Embeddings

16. **Explain semantic search in your project from query → embedding → similarity calculation → ranked results.**

17. **What is an embedding, and why did you choose BGE-small with 384-dimensional vectors?**

18. **Why cosine similarity? Why do you normalize the vectors, and what does that allow you to do?**

19. **Why are you using NumPy brute-force similarity search instead of FAISS, HNSW, or a vector database? At what scale would you change this?**

20. **Why did you store the embeddings as float16, and what are the memory/accuracy trade-offs?**

---

#### 5. AI / RAG

21. **Explain the complete RAG pipeline used by your chatbot.**

22. **How do you prevent the chatbot from hallucinating answers that aren't supported by the question-paper corpus?**

23. **How do citations work in your chatbot? How do you ensure that a citation actually corresponds to the evidence used to generate the answer?**

24. **What happens if semantic retrieval returns irrelevant questions or no useful evidence at all?**

25. **How would you objectively evaluate whether your semantic search and RAG system are actually good?**

---

#### 6. System Design + Production

26. **Your current system works with ~200K questions. What would you change if it grew to 10 million questions and millions of users?**

27. **What are the current bottlenecks in your architecture, and how would you identify them using metrics/profiling rather than guessing?**

28. **Why did you deploy the frontend/backend the way you did, and how would you handle horizontal scaling, caching, rate limiting, and failures?**

29. **What are the biggest security concerns in this project? Consider SQL injection, file access, API keys, chatbot abuse, prompt injection, and rate limiting.**

30. **If I gave you one more month to improve PyQHeaven, what would you change and why?**

---

### How I'd prepare these

Don't just prepare **answers** to these 30. For each one, be able to go **2–3 levels deeper**.

For example:

> **Why SQLite?**

You should be ready for:

> Why SQLite?
> → Why FTS5?
> → How does FTS5 work?
> → What indexes does SQLite use?
> → B-tree vs inverted index?
> → What's the complexity?
> → What happens with 10M questions?
> → When would you move to PostgreSQL?

Similarly:

> **Why BGE-small?**

could become:

> What is an embedding?
> → How is it generated?
> → Why 384 dimensions?
> → Cosine similarity?
> → Why normalize?
> → Why float16?
> → Why brute force?
> → Why not FAISS?
> → How would you evaluate retrieval?

If you can confidently answer these **30 plus the obvious follow-ups**, you'll have covered almost the entire technical surface area of PyQHeaven: **data engineering → OCR → parsing → databases → information retrieval → embeddings → RAG → backend → frontend → deployment → security → system design**.
