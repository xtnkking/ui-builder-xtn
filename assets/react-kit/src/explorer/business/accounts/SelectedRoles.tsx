import { Button, Checkbox, Drawer, EmptyState, Inline, List, OverflowText, Stack } from "../../../ui";
import type { ManagedAccount } from "./account-model";
import "./selected-roles.css";

export type SelectedRolesProps = {
  open: boolean;
  accounts: ManagedAccount[];
  selected: Set<string>;
  onOpenChange: (open: boolean) => void;
  onRemove: (roleId: string) => void;
  busy: boolean;
};

export function SelectedRoles({ open, accounts, selected, onOpenChange, onRemove, busy }: SelectedRolesProps) {
  const groups = accounts.map(account => ({
    account,
    roles: account.roles.filter(role => selected.has(role.id)),
  })).filter(group => group.roles.length > 0);

  return <Drawer open={open} onOpenChange={onOpenChange} title="已选角色" width="large"
    footer={<Inline justify="end"><Button onClick={() => onOpenChange(false)}>关闭</Button></Inline>}>
    {!groups.length ? <EmptyState title="尚未选择角色" compact /> : <Stack gap="large">
      {groups.map(({ account, roles }) => <section key={account.id} className="demo-accounts-selected-roles-account">
        <div className="demo-accounts-selected-roles-account-heading">
          <h3 className="demo-accounts-selected-roles-account-name"><OverflowText>{account.name}</OverflowText></h3>
          <span className="demo-accounts-selected-roles-account-count">{roles.length} 位</span>
        </div>
        <List items={roles} itemKey={role => role.id} density="compact"
          ariaLabel={`${account.name}的已选角色`}
          renderItem={role => <div className="demo-accounts-selected-roles-row">
            <div className="demo-accounts-selected-roles-copy">
              <div className="demo-accounts-selected-roles-name"><OverflowText>{role.name}</OverflowText></div>
              <p className="demo-accounts-selected-roles-meta">{role.level} 级 · {role.school} · {role.server}</p>
            </div>
            <Checkbox label="已选" aria-label={`取消选择角色：${role.id}`} checked={true}
              disabled={busy} onChange={event => { if (!event.target.checked) onRemove(role.id); }} />
          </div>} />
      </section>)}
    </Stack>}
  </Drawer>;
}
