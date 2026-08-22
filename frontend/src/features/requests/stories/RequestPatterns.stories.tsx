import type { Meta, StoryObj } from '@storybook/react-vite';
import { requestSeed } from '@features/requests/testing';
import { RequestCard } from '@features/requests';
import { RequestDetail } from '@features/requests';

function IncomingCard() {
  return <div style={{ width: 620, maxWidth: '100%' }}><RequestCard request={requestSeed[0]} history={false} busy={false} onOpen={() => undefined} onChat={() => undefined} onConfirm={() => undefined} onReject={() => undefined} onRepeat={() => undefined} onReview={() => undefined} onCancel={() => undefined} /></div>;
}
function OutgoingCard() {
  return <div style={{ width: 620, maxWidth: '100%' }}><RequestCard request={requestSeed[5]} history={false} busy={false} onOpen={() => undefined} onChat={() => undefined} onConfirm={() => undefined} onReject={() => undefined} onRepeat={() => undefined} onReview={() => undefined} onCancel={() => undefined} /></div>;
}
function IncomingDetail() {
  return <div style={{ width: 900, maxWidth: '100%', minHeight: 900 }}><RequestDetail request={requestSeed[0]} busy={false} onBack={() => undefined} onOpenListing={() => undefined} onOpenPerson={() => undefined} onOpenChat={() => undefined} onReview={() => undefined} onRepeat={() => undefined} onConfirm={() => undefined} onReject={() => undefined} onCancel={() => undefined} /></div>;
}

const meta = { title: 'Product/Requests', component: IncomingCard, parameters: { layout: 'padded' } } satisfies Meta<typeof IncomingCard>;
export default meta;
export const Incoming: StoryObj<typeof meta> = {};
export const Outgoing: StoryObj<typeof meta> = { render: () => <OutgoingCard /> };
export const Detail: StoryObj<typeof meta> = { render: () => <IncomingDetail />, parameters: { layout: 'fullscreen' } };
