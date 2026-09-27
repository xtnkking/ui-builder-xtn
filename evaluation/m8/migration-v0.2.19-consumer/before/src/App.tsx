import { useMemo, useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  DataTable,
  Drawer,
  Field,
  Form,
  Input,
  PasswordInput,
  Popover,
  Select,
  type DataColumn,
} from "./personal-ui";

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
}

const members: Member[] = [
  { id: "member-1", name: "陈沐", email: "chen.mu@example.com", role: "管理员" },
  { id: "member-2", name: "陆宁", email: "lu.ning@example.com", role: "查看者" },
];

export function App() {
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [loginSaved, setLoginSaved] = useState(false);
  const [employeeName, setEmployeeName] = useState("");
  const [role, setRole] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [employeeSaved, setEmployeeSaved] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const columns = useMemo<DataColumn<Member>[]>(
    () => [
      { id: "name", header: "姓名", cell: (member) => member.name, sortable: true },
      { id: "email", header: "邮箱", cell: (member) => member.email, minWidth: 220 },
      { id: "role", header: "角色", cell: (member) => member.role },
    ],
    [],
  );

  return (
    <main className="migration-page">
      <header className="migration-heading">
        <p>Personal UI v0.2.19 consumer</p>
        <h1>成员接入工作台</h1>
      </header>

      <section className="migration-section" aria-labelledby="login-title">
        <h2 id="login-title">登录</h2>
        <div className="migration-form">
          <Form
            aria-label="登录迁移验证"
            onSubmit={(event) => {
              event.preventDefault();
              setLoginSaved(Boolean(account && password));
            }}
          >
            <Field label="账号" htmlFor="migration-account" required>
              <Input
                id="migration-account"
                name="account"
                value={account}
                onChange={(event) => setAccount(event.target.value)}
                autoComplete="username"
                required
              />
            </Field>
            <Field label="密码" htmlFor="migration-password" required>
              <PasswordInput
                id="migration-password"
                name="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </Field>
            <Button type="submit" variant="primary">登录</Button>
          </Form>
        </div>
        {loginSaved ? <Alert tone="success">登录请求已记录</Alert> : null}
      </section>

      <section className="migration-section" aria-labelledby="form-title">
        <h2 id="form-title">员工表单</h2>
        <div className="migration-form">
          <Form
            aria-label="员工表单迁移验证"
            onSubmit={(event) => {
              event.preventDefault();
              setEmployeeSaved(Boolean(employeeName && role));
            }}
          >
            <Field label="姓名" htmlFor="migration-name" required>
              <Input
                id="migration-name"
                name="employeeName"
                value={employeeName}
                onChange={(event) => setEmployeeName(event.target.value)}
                required
              />
            </Field>
            <Field label="角色" htmlFor="migration-role" required>
              <Select
                ariaLabel="角色"
                value={role}
                onValueChange={setRole}
                options={[
                  { value: "admin", label: "管理员" },
                  { value: "viewer", label: "查看者" },
                ]}
              />
            </Field>
            <Checkbox
              label="启用账号"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
            />
            <Button type="submit" variant="primary">保存员工</Button>
          </Form>
        </div>
        {employeeSaved ? <Alert tone="success">员工资料已保存</Alert> : null}
      </section>

      <section className="migration-section" aria-labelledby="table-title">
        <div className="migration-section-heading">
          <h2 id="table-title">成员列表</h2>
          <Button onClick={() => setDrawerOpen(true)}>打开成员详情</Button>
        </div>
        <DataTable
          ariaLabel="迁移成员列表"
          columns={columns}
          rows={members}
          rowKey={(member) => member.id}
        />
      </section>

      <section className="migration-section" aria-labelledby="overlay-title">
        <h2 id="overlay-title">浮层帮助</h2>
        <Popover
          trigger={<Button>查看迁移帮助</Button>}
          ariaLabel="迁移帮助"
        >
          <p>这个浮层用于验证旧版触发器迁移。</p>
        </Popover>
      </section>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="成员详情"
        description="验证旧消费者升级后的浮层行为"
        closeOnBackdropClick={false}
        footer={<Button onClick={() => setDrawerOpen(false)}>完成</Button>}
      >
        <p>陈沐 · chen.mu@example.com</p>
      </Drawer>
    </main>
  );
}
