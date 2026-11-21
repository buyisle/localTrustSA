import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import { Heart, LogOut, Menu, ShieldCheck, X } from "lucide-react";
import { useAuth } from "../context/auth";
const currentYear = new Date().getFullYear();
export function Brand() { return <Link className="brand" to="/" aria-label="Local Trust SA home"><span className="brand-icon"><ShieldCheck size={25} /></span><span>LocalTrust<span className="brand-sa">SA<span className="brand-dot">.</span></span></span></Link>; }
export default function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  useEffect(() => { if (location.hash) { const frame = requestAnimationFrame(() => document.getElementById(location.hash.slice(1))?.scrollIntoView()); return () => cancelAnimationFrame(frame); } window.scrollTo(0, 0); }, [location.pathname, location.hash]);
  const { user, logout } = useAuth(); const navigate = useNavigate(); const [open, setOpen] = useState(false);
  return <><header className="site-header"><div className="container nav-wrap"><Brand /><button className="icon-button mobile-toggle" aria-expanded={open} aria-controls="main-navigation" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button><nav id="main-navigation" className={`nav-links ${open ? "is-open" : ""}`} aria-label="Main navigation" onClick={() => setOpen(false)}><NavLink to="/#services" end>Find a service</NavLink><Link to="/#how-it-works">How it works</Link>{user ? <><NavLink to="/dashboard">My dashboard</NavLink>{user.role !== "admin" && <NavLink to="/messages">Messages</NavLink>}<span className="nav-user"><span className="avatar">{user.name.charAt(0).toUpperCase()}</span>{user.name.split(" ")[0]}</span><button className="icon-button" aria-label="Log out" onClick={() => { logout(); navigate("/login"); }}><LogOut size={19} /></button></> : <><NavLink to="/login">Log in</NavLink><Link className="button small" to="/register">Get started</Link></>}</nav></div></header><div className="page-content">{children}</div><footer className="site-footer"><div className="container footer-top"><div><Brand /><p>Local people. Real skills. Better connections.</p></div><div className="footer-links"><Link to="/">Explore services</Link><Link to="/register?role=provider">Become a provider</Link></div></div><div className="container footer-bottom"><span>© {currentYear} Local Trust SA. All rights reserved.</span><span>Made for South Africa <Heart size={13} /></span></div></footer></>;
}


