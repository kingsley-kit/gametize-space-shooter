const triviaQuestions = [
    {
        question: "What is the main purpose of using Gametize?",
        options: [
            "To drive engagement through gamification",
            "To build full-scale video games",
            "To host e-commerce transactions",
            "To develop custom social media platforms"
        ],
        correctAnswer: 0
    },
    {
        question: "Which feature is NOT typically found in Gametize?",
        options: [
            "Points and rewards system",
            "Leaderboards",
            "Virtual reality integration",
            "Progress tracking"
        ],
        correctAnswer: 2
    },
    {
        question: "What type of content can be gamified using Gametize?",
        options: [
            "Only educational content",
            "Only corporate training",
            "Any type of content",
            "Only mobile apps"
        ],
        correctAnswer: 2
    },
    {
        question: "What is a core advantage of using Gametize?",
        options: [
            "Boosting engagement through gamification mechanics",
            "Automating backend infrastructure",
            "Outsourcing content moderation",
            "Reducing app store approval time"
        ],
        correctAnswer: 0
    },
    {
        question: "Which devices or platforms does Gametize support?",
        options: [
            "Mobile devices only",
            "Web platforms only",
            "Both web and mobile (cross-platform)",
            "Virtual reality headsets only"
        ],
        correctAnswer: 2
    }
];

class TriviaSystem {
    constructor() {
        this.modal = document.getElementById('triviaModal');
        this.questionElement = document.getElementById('triviaQuestion');
        this.optionsElement = document.getElementById('triviaOptions');
        this.submitButton = document.getElementById('submitAnswer');
        this.feedbackElement = document.createElement('div');
        this.feedbackElement.id = 'triviaFeedback';
        this.modal.querySelector('.modal-content').appendChild(this.feedbackElement);
        this.selectedAnswer = null;
        this.currentQuestion = null;
        this.onAnswerCallback = null;
        
        // Track answered questions
        this.answeredQuestions = new Set();
        
        // Initialize sound effects
        this.correctSound = document.getElementById('correctSound');
        this.wrongSound = document.getElementById('wrongSound');
        
        // Set initial volume for sound effects
        if (this.correctSound) this.correctSound.volume = 0.5;
        if (this.wrongSound) this.wrongSound.volume = 0.5;

        this.setupEventListeners();
    }

    setupEventListeners() {
        this.submitButton.addEventListener('click', () => this.submitAnswer());
    }

    playSound(isCorrect) {
        const sound = isCorrect ? this.correctSound : this.wrongSound;
        if (sound) {
            sound.currentTime = 0; // Reset sound to start
            sound.play().catch(error => {
                console.warn('Error playing sound effect:', error);
            });
        }
    }

    getRandomUnansweredQuestion() {
        // If all questions have been answered, reset the tracking
        if (this.answeredQuestions.size >= triviaQuestions.length) {
            this.answeredQuestions.clear();
        }

        // Get array of unanswered question indices
        const unansweredIndices = Array.from(
            { length: triviaQuestions.length },
            (_, i) => i
        ).filter(i => !this.answeredQuestions.has(i));

        // Pick a random index from unanswered questions
        const randomIndex = Math.floor(Math.random() * unansweredIndices.length);
        return unansweredIndices[randomIndex];
    }

    showQuestion(callback) {
        this.onAnswerCallback = callback;
        
        // Get a random unanswered question
        const questionIndex = this.getRandomUnansweredQuestion();
        this.currentQuestion = triviaQuestions[questionIndex];
        
        this.questionElement.textContent = this.currentQuestion.question;
        this.optionsElement.innerHTML = '';
        this.feedbackElement.innerHTML = '';
        this.submitButton.style.display = 'block';
        this.selectedAnswer = null;
        
        this.currentQuestion.options.forEach((option, index) => {
            const button = document.createElement('button');
            button.textContent = option;
            button.value = index;
            button.onclick = () => {
                this.selectedAnswer = index;
                this.optionsElement.querySelectorAll('button').forEach(btn => btn.classList.remove('selected'));
                button.classList.add('selected');
            };
            this.optionsElement.appendChild(button);
        });

        this.modal.style.display = 'flex';
    }

    submitAnswer() {
        if (this.selectedAnswer === null) {
            alert('Please select an answer.');
            return;
        }

        const isCorrect = parseInt(this.selectedAnswer) === this.currentQuestion.correctAnswer;
        const selectedAnswerText = this.currentQuestion.options[this.selectedAnswer];
        const correctAnswerText = this.currentQuestion.options[this.currentQuestion.correctAnswer];
        
        // Play the appropriate sound effect
        this.playSound(isCorrect);

        // Mark the current question as answered
        const currentQuestionIndex = triviaQuestions.indexOf(this.currentQuestion);
        this.answeredQuestions.add(currentQuestionIndex);

        this.optionsElement.innerHTML = '';
        this.submitButton.style.display = 'none';

        if (isCorrect) {
            this.feedbackElement.innerHTML = `
                <p class="correct">Correct!</p>
                <p>Your answer: <strong>${selectedAnswerText}</strong></p>`;
        } else {
            this.feedbackElement.innerHTML = `
                <p class="incorrect">Wrong!</p>
                <p>Your answer: <strong>${selectedAnswerText}</strong></p>
                <p>The correct answer was: <strong>${correctAnswerText}</strong></p>`;
        }

        const continueButton = document.createElement('button');
        continueButton.textContent = 'Continue';
        continueButton.onclick = () => this.closeModalAfterFeedback(isCorrect);
        this.feedbackElement.appendChild(continueButton);
    }

    closeModalAfterFeedback(isCorrect) {
        this.modal.style.display = 'none';
        this.feedbackElement.innerHTML = '';
        
        if (this.onAnswerCallback) {
            this.onAnswerCallback(isCorrect);
        }
    }
}

// Export the TriviaSystem class
window.TriviaSystem = TriviaSystem; 