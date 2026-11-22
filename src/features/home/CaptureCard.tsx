'use client';
import { ImagePlus, NotebookPen, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useI18n } from '@/components/LanguageProvider';
import { Button, Card, TextArea } from '@/ui';
import s from './home.module.css';

type Props = {
  disabled?: boolean;
  /** One sentence for the assistant to turn into draft entries. */
  onSay: (text: string) => void;
  onImages: (files: FileList) => void;
  onManual: () => void;
};

/** Both ways of recording sit side by side: tell the bear, or fill the form yourself. */
export function CaptureCard({ disabled, onSay, onImages, onManual }: Props) {
  const { t } = useI18n();
  const [text, setText] = useState('');
  const submit = () => {
    const value = text.trim();
    if (!value) return;
    onSay(value);
    setText('');
  };
  return (
    <Card tone="raised" className={s.capture}>
      <div className={s.captureHead}>
        <h2>{t('记一笔')}</h2>
        <span className={s.or}>{t('说一句、传张图，或手动填写')}</span>
      </div>
      <div className={s.say}>
        <TextArea
          aria-label={t('用一句话记账')}
          placeholder={t('例如：午饭 32 微信；昨天超市买菜 86.5')}
          value={text}
          disabled={disabled}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <Button
          variant="primary"
          disabled={disabled || !text.trim()}
          onClick={submit}
          icon={<Sparkles size={17} />}
        >
          {t('交给小熊')}
        </Button>
      </div>
      <div className={s.captureActions}>
        <label className={`${s.upload}`}>
          <Button
            variant="secondary"
            size="sm"
            tabIndex={-1}
            icon={<ImagePlus size={16} />}
            disabled={disabled}
          >
            {t('传账单图片')}
          </Button>
          <input
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp"
            aria-label={t('传账单图片')}
            disabled={disabled}
            onChange={e => {
              if (e.target.files?.length) onImages(e.target.files);
              e.target.value = '';
            }}
          />
        </label>
        <Button
          variant="secondary"
          size="sm"
          icon={<NotebookPen size={16} />}
          disabled={disabled}
          onClick={onManual}
        >
          {t('手动记一笔')}
        </Button>
      </div>
    </Card>
  );
}
