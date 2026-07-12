import { ModuleGate } from '../../../../components/module-gate';

export default function TasksLayout({ children }: { children: React.ReactNode }) {
  return <ModuleGate module="crm">{children}</ModuleGate>;
}
