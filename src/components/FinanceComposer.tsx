'use client';
import styles from './FinanceComposer.module.css';
import { Button } from '@/ui';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  Paperclip,
  SlidersHorizontal,
  Maximize2,
  Minimize2,
  X,
  LoaderCircle,
  ArrowRight,
  Brain,
} from 'lucide-react';
import { useI18n } from './LanguageProvider';
import { uploadReceipt } from '@/lib/upload-receipt';
type Attachment = { name: string; data: string };
export function FinanceComposer({
  locationControl,
  scopeControl,
  book,
  text,
  onText,
  images,
  onImages,
  busy,
  uploading,
  onUploading,
  useHistory,
  onHistory,
  thinking,
  onThinking,
  onSend,
  onBackground,
  onError,
  reply,
  onCancelReply,
}: {
  locationControl?: import('react').ReactNode;
  scopeControl?: import('react').ReactNode;
  book: string;
  text: string;
  onText: (s: string) => void;
  images: Attachment[];
  onImages: (fn: (v: Attachment[]) => Attachment[]) => void;
  busy: boolean;
  uploading: boolean;
  onUploading: (v: boolean) => void;
  useHistory: boolean;
  onHistory: (v: boolean) => void;
  thinking: boolean;
  onThinking: (v: boolean) => void;
  onSend: () => void;
  onBackground: () => void;
  onError: (s: string) => void;
  reply?: string;
  onCancelReply: () => void;
}) {
  const { t: tr } = useI18n();
  const textarea = useRef<HTMLTextAreaElement>(null),
    file = useRef<HTMLInputElement>(null),
    box = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false),
    [drag, setDrag] = useState(false),
    [long, setLong] = useState(false);
  useLayoutEffect(() => {
    const el = textarea.current;
    if (!el) return;
    const resize = () => {
      el.style.height = '0px';
      const natural = el.scrollHeight;
      const viewport = window.visualViewport?.height || window.innerHeight;
      const cap = expanded
        ? Math.max(96, Math.min(360, viewport * 0.42))
        : Math.max(64, Math.min(160, viewport * 0.24));
      el.style.height = Math.min(cap, Math.max(40, natural)) + 'px';
      el.style.overflowY = natural > cap ? 'auto' : 'hidden';
      setLong(natural > 96);
    };
    resize();
    const observer = new ResizeObserver(resize);
    if (box.current) observer.observe(box.current);
    window.visualViewport?.addEventListener('resize', resize);
    return () => {
      observer.disconnect();
      window.visualViewport?.removeEventListener('resize', resize);
    };
  }, [text, expanded]);
  useEffect(() => {
    if (!text) setExpanded(false);
  }, [text]);
  async function add(files: File[]) {
    if (busy || uploading || !files.length) return;
    onUploading(true);
    onError('');
    try {
      for (const f of files) {
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(f.type))
          throw new Error('请选择PNG、JPEG或WebP图片');
        const added = await uploadReceipt(book, f);
        onImages(v => [...v, added]);
      }
    } catch (e) {
      onError((e as Error).message);
    } finally {
      onUploading(false);
    }
  }
  return (
    <div className={styles.financeComposer} role="group" aria-label={tr('给财务助手发送消息')}>
      {reply && (
        <div className={styles.chatReplyTarget}>
          <span>
            {tr('正在修改')} · {reply}
          </span>
          <Button variant="ghost" type="button" aria-label={tr('取消指定修改')} onClick={onCancelReply}>
            <X size={15} />
          </Button>
        </div>
      )}
      <div
        ref={box}
        className={styles.composerBox}
        data-dragging={drag}
        onDragOver={e => {
          if (e.dataTransfer.types.includes('Files')) {
            e.preventDefault();
            setDrag(true);
          }
        }}
        onDragLeave={e => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrag(false);
        }}
        onDrop={e => {
          e.preventDefault();
          setDrag(false);
          add(Array.from(e.dataTransfer.files));
        }}
      >
        {images.length > 0 && (
          <>
            <div className={styles.composerPreviews}>
              {images.map((f, i) => (
                <div className={styles.composerPreview} key={f.data}>
                  <img src={f.data} alt={f.name} />
                  <Button
                    variant="primary"
                    type="button"
                    disabled={busy}
                    title={tr('移除图片')}
                    aria-label={tr('移除图片') + ' ' + f.name}
                    onClick={() => onImages(v => v.filter((_, n) => n !== i))}
                  >
                    <X size={13} />
                  </Button>
                  <span title={f.name}>{f.name}</span>
                </div>
              ))}
            </div>
            <small className={styles.composerAttachmentStatus} role="status">
              {tr('已添加 {0} 张图片，发送时会一并提交').replace('{0}', String(images.length))}
            </small>
          </>
        )}
        <textarea
          ref={textarea}
          rows={1}
          aria-label={tr('给财务助手发送消息')}
          placeholder={tr('描述一笔消费，或问问你的账本…')}
          value={text}
          disabled={busy}
          onChange={e => onText(e.target.value)}
          onPaste={e => {
            const files = Array.from(e.clipboardData.files);
            if (files.length) {
              e.preventDefault();
              add(files);
            }
          }}
          onKeyDown={e => {
            if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) return;
            if (e.key === 'Enter' && !e.shiftKey && (e.ctrlKey || e.metaKey || window.innerWidth > 730)) {
              e.preventDefault();
              if (!uploading) onSend();
            }
          }}
        />
        <div className={styles.composerTools}>
          <div className={styles.composerToolsLeft}>
            <input
              hidden
              ref={file}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp"
              onChange={e => {
                const files = Array.from(e.target.files || []);
                e.target.value = '';
                add(files);
              }}
            />
            <Button
              className={styles.composerIcon}
              type="button"
              disabled={busy || uploading}
              aria-label={tr('添加账单图片')}
              title={tr('添加账单图片')}
              onClick={() => file.current?.click()}
            >
              {uploading ? (
                <LoaderCircle className={styles.composerSpinner} size={19} />
              ) : (
                <Paperclip size={19} />
              )}
            </Button>
            <details className={styles.composerOptions}>
              <summary title={tr('对话偏好')} aria-label={tr('对话偏好')}>
                <SlidersHorizontal size={18} />
              </summary>
              <div>
                <label className={styles.check}>
                  <input type="checkbox" checked={useHistory} onChange={e => onHistory(e.target.checked)} />
                  {tr('使用我的记账偏好')}
                </label>
                <small>{tr('参考已确认记录，建议分类、钱包与消费场景；本次输入优先。')}</small>
                {locationControl}
              </div>
            </details>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className={styles.composerToggle}
              aria-pressed={thinking}
              disabled={busy}
              aria-label={tr('开启思考模式')}
              title={tr(thinking ? '已开启思考模式，点击关闭' : '点击开启思考模式')}
              onClick={() => onThinking(!thinking)}
            >
              <Brain size={16} aria-hidden="true" />
              <span>{tr('思考')}</span>
            </Button>
            {scopeControl}
            {(long || expanded) && (
              <Button
                className={styles.composerIcon}
                type="button"
                aria-label={tr(expanded ? '收起输入框' : '展开输入框')}
                title={tr(expanded ? '收起输入框' : '展开输入框')}
                onClick={() => {
                  setExpanded(v => !v);
                  textarea.current?.focus();
                }}
              >
                {expanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </Button>
            )}
            {uploading && <small role="status">{tr('正在上传图片…')}</small>}
          </div>
          {busy ? (
            <Button
              type="button"
              className={styles.composerBackground}
              onClick={onBackground}
              title={tr('后台继续')}
            >
              <ArrowRight size={17} />
              <span>{tr('后台继续')}</span>
            </Button>
          ) : (
            <Button
              type="button"
              className={styles.composerSend}
              aria-label={tr('发送')}
              title={tr('发送')}
              disabled={uploading || (!text.trim() && !images.length)}
              onClick={onSend}
            >
              <ArrowUp size={21} />
            </Button>
          )}
        </div>
      </div>
      <small className={styles.composerShortcut}>{tr('Enter 发送 · Shift + Enter 换行')}</small>
    </div>
  );
}
