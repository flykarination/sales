begin;

/**
 * Pay for a booking entirely in miles.
 *
 * The reservation is created as an ordinary cash booking first and converted
 * here, rather than having a separate award booking path. That keeps one
 * selling flow, one set of seat checks and one price — the miles cost is
 * simply the cash fare at the published rate.
 */
create or replace function public.pay_with_miles(p_pnr text, p_email text)
returns table (ok boolean, message text, miles_spent integer, balance_miles integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_booking uuid;
    v_total   numeric(12,2);
    v_member  public.ff_members%rowtype;
    v_cost    integer;
begin
    select b.booking_id, b.total_amount_usd into v_booking, v_total
      from public.bookings b
     where b.pnr = upper(trim(p_pnr))
       and lower(b.contact_email) = lower(trim(p_email))
       and b.status = 'CONFIRMED';
    if v_booking is null then
        return query select false, 'No such booking.'::text, 0, 0; return;
    end if;

    if v_total <= 0 then
        return query select false, 'This booking is already paid with miles.'::text, 0, 0; return;
    end if;

    select * into v_member from public.ff_members where lower(email) = lower(trim(p_email));
    if not found then
        return query select false,
            'Award flights are for RainbowOne members. Joining is free.'::text, 0, 0;
        return;
    end if;

    v_cost := public.kx_award_price(v_total);

    if v_member.balance_miles < v_cost then
        return query select false,
            ('This flight costs ' || v_cost || ' miles and you have '
             || v_member.balance_miles || '.')::text, 0, v_member.balance_miles;
        return;
    end if;

    insert into public.ff_transactions
        (member_id, txn_type, miles, qualifying_miles, description)
    values (v_member.member_id, 'REDEEM', -v_cost, 0,
            'Award flight · booking ' || upper(trim(p_pnr)));

    update public.ff_members
       set balance_miles = public.ff_members.balance_miles - v_cost,
           updated_at = now()
     where member_id = v_member.member_id;

    -- the fare is now zero: it was paid in miles, not dollars
    update public.bookings set total_amount_usd = 0, updated_at = now()
     where booking_id = v_booking;
    update public.tickets t set fare_usd = 0, taxes_usd = 0
      from public.booking_segments s
     where s.segment_id = t.segment_id and s.booking_id = v_booking;

    insert into public.booking_events (booking_id, event_type, detail)
    values (v_booking, 'AWARD_ISSUED', 'Paid with ' || v_cost || ' RainbowOne miles');

    return query select true,
        ('Paid with ' || v_cost || ' miles.')::text, v_cost, v_member.balance_miles - v_cost;
end;
$$;

grant execute on function public.pay_with_miles(text, text) to anon, authenticated;

commit;
