import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';

interface ConfirmProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ResetDialog({ open, onCancel, onConfirm }: ConfirmProps) {
  return (
    <Dialog
      open={open}
      role="alertdialog"
      title="إعادة البرنامج"
      onClose={onCancel}
      footer={
        <>
          <Button variant="quiet" onClick={onCancel} autoFocus>
            إلغاء
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            تأكيد إعادة البرنامج
          </Button>
        </>
      }
    >
      <p className="sheet__lead">
        هل أنت متأكد من إعادة البرنامج من البداية؟ سيتم حذف النتائج والتقدم والعودة إلى اختبار تحديد المستوى.
      </p>
    </Dialog>
  );
}

export function PauseDialog({ open, onCancel, onConfirm, resuming }: ConfirmProps & { resuming: boolean }) {
  return (
    <Dialog
      open={open}
      title={resuming ? 'العودة من التوقف الصحي' : 'توقف صحي'}
      onClose={onCancel}
      footer={
        <>
          <Button variant="quiet" onClick={onCancel}>
            إلغاء
          </Button>
          <Button variant="primary" onClick={onConfirm}>
            {resuming ? 'نعم، أنا جاهز للعودة' : 'بدء التوقف الصحي'}
          </Button>
        </>
      }
    >
      <p className="sheet__lead">
        {resuming
          ? 'عُد فقط إن كنت تشعر بالجاهزية. إن فاتتك 5 أيام تدريب أو أكثر خلال التوقف نطلب تحديد مستوى جديد، وإن فاتت 3–4 أيام نرجع حصة احتياطًا.'
          : 'يجمّد الخطة أثناء المرض أو الإصابة، ولا تُحتسب أيامه غيابًا، وتؤجَّل مراجعة المستوى حتى عودتك. لا تتدرب أثناء المرض أو الإصابة.'}
      </p>
      <p className="fineprint">التطبيق لا يشخّص حالتك ولا يؤكد جاهزيتك طبيًا.</p>
    </Dialog>
  );
}
