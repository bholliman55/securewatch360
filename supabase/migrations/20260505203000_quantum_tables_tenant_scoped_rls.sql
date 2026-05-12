-- Agent 6 quantum tables: replace permissive placeholder RLS with tenant_users-scoped policies.
-- client_id aligns with tenants.id and tenant_users.tenant_id.

-- quantum_crypto_inventory
drop policy if exists "quantum_crypto_inventory_select" on public.quantum_crypto_inventory;
drop policy if exists "quantum_crypto_inventory_insert" on public.quantum_crypto_inventory;
drop policy if exists "quantum_crypto_inventory_update" on public.quantum_crypto_inventory;

create policy "quantum_crypto_inventory_select"
  on public.quantum_crypto_inventory
  for select
  to authenticated
  using (
    client_id in (
      select tu.tenant_id
      from public.tenant_users tu
      where tu.user_id = (select auth.uid())
    )
  );

create policy "quantum_crypto_inventory_insert"
  on public.quantum_crypto_inventory
  for insert
  to authenticated
  with check (
    client_id in (
      select tu.tenant_id
      from public.tenant_users tu
      where tu.user_id = (select auth.uid())
        and tu.role in ('owner', 'admin', 'analyst')
    )
  );

create policy "quantum_crypto_inventory_update"
  on public.quantum_crypto_inventory
  for update
  to authenticated
  using (
    client_id in (
      select tu.tenant_id
      from public.tenant_users tu
      where tu.user_id = (select auth.uid())
        and tu.role in ('owner', 'admin', 'analyst')
    )
  )
  with check (
    client_id in (
      select tu.tenant_id
      from public.tenant_users tu
      where tu.user_id = (select auth.uid())
        and tu.role in ('owner', 'admin', 'analyst')
    )
  );

-- quantum_readiness_assessments (insert-only mutations in original schema)
drop policy if exists "quantum_readiness_assessments_select" on public.quantum_readiness_assessments;
drop policy if exists "quantum_readiness_assessments_insert" on public.quantum_readiness_assessments;

create policy "quantum_readiness_assessments_select"
  on public.quantum_readiness_assessments
  for select
  to authenticated
  using (
    client_id in (
      select tu.tenant_id
      from public.tenant_users tu
      where tu.user_id = (select auth.uid())
    )
  );

create policy "quantum_readiness_assessments_insert"
  on public.quantum_readiness_assessments
  for insert
  to authenticated
  with check (
    client_id in (
      select tu.tenant_id
      from public.tenant_users tu
      where tu.user_id = (select auth.uid())
        and tu.role in ('owner', 'admin', 'analyst')
    )
  );

-- quantum_remediation_tasks
drop policy if exists "quantum_remediation_tasks_select" on public.quantum_remediation_tasks;
drop policy if exists "quantum_remediation_tasks_insert" on public.quantum_remediation_tasks;
drop policy if exists "quantum_remediation_tasks_update" on public.quantum_remediation_tasks;

create policy "quantum_remediation_tasks_select"
  on public.quantum_remediation_tasks
  for select
  to authenticated
  using (
    client_id in (
      select tu.tenant_id
      from public.tenant_users tu
      where tu.user_id = (select auth.uid())
    )
  );

create policy "quantum_remediation_tasks_insert"
  on public.quantum_remediation_tasks
  for insert
  to authenticated
  with check (
    client_id in (
      select tu.tenant_id
      from public.tenant_users tu
      where tu.user_id = (select auth.uid())
        and tu.role in ('owner', 'admin', 'analyst')
    )
  );

create policy "quantum_remediation_tasks_update"
  on public.quantum_remediation_tasks
  for update
  to authenticated
  using (
    client_id in (
      select tu.tenant_id
      from public.tenant_users tu
      where tu.user_id = (select auth.uid())
        and tu.role in ('owner', 'admin', 'analyst')
    )
  )
  with check (
    client_id in (
      select tu.tenant_id
      from public.tenant_users tu
      where tu.user_id = (select auth.uid())
        and tu.role in ('owner', 'admin', 'analyst')
    )
  );

-- quantum_policy_results
drop policy if exists "quantum_policy_results_select" on public.quantum_policy_results;
drop policy if exists "quantum_policy_results_insert" on public.quantum_policy_results;

create policy "quantum_policy_results_select"
  on public.quantum_policy_results
  for select
  to authenticated
  using (
    client_id in (
      select tu.tenant_id
      from public.tenant_users tu
      where tu.user_id = (select auth.uid())
    )
  );

create policy "quantum_policy_results_insert"
  on public.quantum_policy_results
  for insert
  to authenticated
  with check (
    client_id in (
      select tu.tenant_id
      from public.tenant_users tu
      where tu.user_id = (select auth.uid())
        and tu.role in ('owner', 'admin', 'analyst')
    )
  );
