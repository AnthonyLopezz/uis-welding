import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { useAsync } from '../hooks/useAsync.ts';
import { useDocumentMeta } from '../hooks/useDocumentMeta.ts';
import { useProgress } from '../store/ProgressContext.tsx';
import { getTopics } from '../services/contentRepository.ts';
import { getQuestionById } from '../services/questionRepository.ts';
import { AsyncView } from '../components/States.tsx';
import { QuestionCard, type AnsweredState } from '../components/QuestionCard.tsx';

/** Práctica de una pregunta suelta (enlace directo, p. ej. desde una revisión de errores). */
export default function QuestionPage() {
  const { id = '' } = useParams();
  const { recordAnswer } = useProgress();
  const [answered, setAnswered] = useState<AnsweredState>();
  const data = useAsync(async () => {
    const question = await getQuestionById(id);
    if (!question) return undefined;
    const topic = (await getTopics()).find((t) => t.id === question.topicId);
    return { question, topicTitle: topic?.title ?? '' };
  }, [id]);
  useDocumentMeta('Pregunta');

  return (
    <AsyncView state={data} notFound="La pregunta">
      {({ question, topicTitle }) => (
        <div className="stack-lg narrow">
          <Link to={`/tema/${question.topicId}`} className="back"><ArrowLeft size={18} aria-hidden /> {topicTitle}</Link>
          <QuestionCard
            question={question}
            answered={answered}
            onSubmit={(answer, correct) => { setAnswered({ answer, correct }); recordAnswer(question, correct); }}
          />
          {answered && (
            <div className="actions">
              <Link className="btn btn--primary" to="/repaso">Seguir repasando</Link>
              <Link className="btn btn--ghost" to={`/evaluacion?tema=${question.topicId}`}>Más preguntas de este tema</Link>
            </div>
          )}
        </div>
      )}
    </AsyncView>
  );
}
